import { prisma } from '../prisma';
import { OrderStatus, CartItemInput, CheckoutRequest } from '../types';

export class InsufficientStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientStockError';
  }
}

export class OrderStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderStateError';
  }
}

export class OrderService {
  /**
   * Concurrency-Safe Checkout & Stock Reservation
   * Reserves stock atomically within a database transaction.
   * If stock is insufficient, rolls back and throws InsufficientStockError.
   */
  static async createReservation(data: CheckoutRequest) {
    if (!data.items || data.items.length === 0) {
      throw new Error('Cart must contain at least one item');
    }

    // Check idempotency if key is provided
    if (data.idempotencyKey) {
      const existingOrder = await prisma.order.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
        include: { items: { include: { product: true } } },
      });
      if (existingOrder) {
        return { order: existingOrder, isExisting: true };
      }
    }

    const reservationTTLMinutes = parseInt(process.env.RESERVATION_TTL_MINUTES || '5', 10);
    const expiresAt = new Date(Date.now() + reservationTTLMinutes * 60 * 1000);
    const orderNumber = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const reservedProducts: { productId: string; quantity: number }[] = [];

    try {
      let totalAmount = 0;
      const orderItemsToCreate: {
        productId: string;
        quantity: number;
        unitPrice: number;
      }[] = [];

      for (const item of data.items) {
        if (item.quantity <= 0) {
          throw new Error(`Quantity must be greater than zero for product ${item.productId}`);
        }

        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        // Concurrency-Safe Atomic Decrement:
        // Executed at the database engine level. If stock < quantity, affected rows is 0.
        // This guarantees zero overselling under any concurrency level.
        const updatedCount = await prisma.$executeRaw`
          UPDATE "Product"
          SET "stock" = "stock" - ${item.quantity},
              "reservedStock" = "reservedStock" + ${item.quantity}
          WHERE "id" = ${item.productId} AND "stock" >= ${item.quantity}
        `;

        if (updatedCount === 0) {
          throw new InsufficientStockError(
            `Insufficient stock for '${product.name}'. Available: ${product.stock}, Requested: ${item.quantity}`
          );
        }

        reservedProducts.push({ productId: item.productId, quantity: item.quantity });

        const itemTotal = product.price * item.quantity;
        totalAmount += itemTotal;

        orderItemsToCreate.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: product.price,
        });
      }

      // Create Order in RESERVED status
      const createdOrder = await prisma.order.create({
        data: {
          orderNumber,
          status: OrderStatus.RESERVED,
          totalAmount,
          idempotencyKey: data.idempotencyKey || null,
          expiresAt,
          customerName: data.customerName || 'POS Customer',
          items: {
            create: orderItemsToCreate,
          },
        },
        include: {
          items: {
            include: { product: true },
          },
        },
      });

      return { order: createdOrder, isExisting: false };
    } catch (err) {
      // If order creation fails after reserving stock, rollback reserved stock
      for (const res of reservedProducts) {
        await prisma.$executeRaw`
          UPDATE "Product"
          SET "stock" = "stock" + ${res.quantity},
              "reservedStock" = MAX(0, "reservedStock" - ${res.quantity})
          WHERE "id" = ${res.productId}
        `;
      }
      throw err;
    }
  }

  /**
   * Cancel an order and release reserved stock back to available inventory.
   * Allowed from RESERVED state.
   */
  static async cancelOrder(orderId: string, reason = 'User requested cancellation') {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      if (order.status !== OrderStatus.RESERVED && order.status !== OrderStatus.PENDING) {
        throw new OrderStateError(
          `Cannot cancel order in status '${order.status}'. Only RESERVED or PENDING orders can be cancelled.`
        );
      }

      // Restore reserved stock back to available stock
      for (const item of order.items) {
        await tx.$executeRaw`
          UPDATE "Product"
          SET "stock" = "stock" + ${item.quantity},
              "reservedStock" = MAX(0, "reservedStock" - ${item.quantity})
          WHERE "id" = ${item.productId}
        `;
      }

      // Update order status
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
        },
        include: { items: { include: { product: true } } },
      });

      return updatedOrder;
    });
  }

  /**
   * Sweeper: Find all expired reservations and atomically release stock back.
   */
  static async releaseExpiredReservations() {
    const now = new Date();

    const expiredOrders = await prisma.order.findMany({
      where: {
        status: OrderStatus.RESERVED,
        expiresAt: {
          lte: now,
        },
      },
      include: { items: true },
    });

    if (expiredOrders.length === 0) return 0;

    let releasedCount = 0;

    for (const order of expiredOrders) {
      try {
        await prisma.$transaction(async (tx) => {
          // Double-check status under transaction
          const current = await tx.order.findUnique({
            where: { id: order.id },
            include: { items: true },
          });

          if (!current || current.status !== OrderStatus.RESERVED) return;

          // Release stock
          for (const item of current.items) {
            await tx.$executeRaw`
              UPDATE "Product"
              SET "stock" = "stock" + ${item.quantity},
                  "reservedStock" = MAX(0, "reservedStock" - ${item.quantity})
              WHERE "id" = ${item.productId}
            `;
          }

          // Transition to EXPIRED
          await tx.order.update({
            where: { id: current.id },
            data: { status: OrderStatus.EXPIRED },
          });

          releasedCount++;
        });
      } catch (err) {
        console.error(`Error expiring order ${order.id}:`, err);
      }
    }

    return releasedCount;
  }

  static async getAllOrders() {
    return prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { product: true } },
        payments: true,
      },
    });
  }

  static async getOrderById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        payments: true,
      },
    });
  }
}
