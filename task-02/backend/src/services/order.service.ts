import { prisma } from '../prisma';
import { OrderStatus, CheckoutRequest } from '../types';

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
   * Checkout & Pre-Payment Stock Reservation
   * Locks the inventory items for 5 minutes before payment attempt.
   */
  static async createReservation(data: CheckoutRequest) {
    if (!data.items || data.items.length === 0) {
      throw new Error('Cart must contain at least one item');
    }

    if (data.idempotencyKey) {
      const existing = await prisma.order.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
        include: { items: { include: { product: true } }, payments: true },
      });
      if (existing) {
        return { order: existing, isExisting: true };
      }
    }

    const reservationTTLMinutes = parseInt(process.env.RESERVATION_TTL_MINUTES || '5', 10);
    const expiresAt = new Date(Date.now() + reservationTTLMinutes * 60 * 1000);
    const orderNumber = `ECOM-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const reservedList: { productId: string; quantity: number }[] = [];

    try {
      let totalAmount = 0;
      const orderItemsToCreate: {
        productId: string;
        quantity: number;
        unitPrice: number;
      }[] = [];

      for (const item of data.items) {
        if (item.quantity <= 0) {
          throw new Error('Item quantity must be greater than zero');
        }

        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        // Concurrency-Safe Atomic Decrement
        const count = await prisma.$executeRaw`
          UPDATE "Product"
          SET "stock" = "stock" - ${item.quantity},
              "reservedStock" = "reservedStock" + ${item.quantity}
          WHERE "id" = ${item.productId} AND "stock" >= ${item.quantity}
        `;

        if (count === 0) {
          throw new InsufficientStockError(
            `Sorry, '${product.name}' is out of stock! Available: ${product.stock}, Requested: ${item.quantity}`
          );
        }

        reservedList.push({ productId: item.productId, quantity: item.quantity });

        totalAmount += product.price * item.quantity;
        orderItemsToCreate.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: product.price,
        });
      }

      const createdOrder = await prisma.order.create({
        data: {
          orderNumber,
          customerEmail: data.customerEmail || 'shopper@techloom.store',
          customerName: data.customerName || 'Online Shopper',
          shippingAddress: data.shippingAddress || '123 Techloom Blvd, Suite 400',
          status: OrderStatus.RESERVED,
          totalAmount,
          idempotencyKey: data.idempotencyKey || null,
          expiresAt,
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
      // Rollback any reserved items if creation fails
      for (const res of reservedList) {
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
   * Post-Purchase: Cancel order & simulate refund
   * If order was PAID -> changes status to REFUNDED, adds refund transaction, restores stock!
   * If order was RESERVED -> changes status to CANCELLED, restores stock!
   */
  static async cancelOrRefundOrder(orderId: string, reason = 'Customer requested cancellation') {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payments: true },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REFUNDED) {
      throw new OrderStateError(`Order is already in '${order.status}' status.`);
    }

    // 1. If order was PAID: Simulate full refund
    if (order.status === OrderStatus.PAID) {
      // Restore physical stock to available stock
      for (const item of order.items) {
        await prisma.$executeRaw`
          UPDATE "Product"
          SET "stock" = "stock" + ${item.quantity}
          WHERE "id" = ${item.productId}
        `;
      }

      // Record refund payment transaction
      await prisma.paymentTransaction.create({
        data: {
          orderId: order.id,
          type: 'REFUND',
          status: 'SUCCESS',
          amount: order.totalAmount,
          gatewayResponse: JSON.stringify({
            code: 'REFUND_SETTLED',
            reason: reason,
            refundId: `REF-${Date.now()}`,
          }),
        },
      });

      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.REFUNDED },
        include: { items: { include: { product: true } }, payments: true },
      });

      return {
        order: updatedOrder,
        action: 'REFUNDED',
        message: `Order refunded successfully (LKR ). Stock restored to storefront.`,
      };
    }

    // 2. If order was RESERVED or PENDING: Cancel and release reservation
    if (order.status === OrderStatus.RESERVED || order.status === OrderStatus.PENDING) {
      for (const item of order.items) {
        await prisma.$executeRaw`
          UPDATE "Product"
          SET "stock" = "stock" + ${item.quantity},
              "reservedStock" = MAX(0, "reservedStock" - ${item.quantity})
          WHERE "id" = ${item.productId}
        `;
      }

      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED },
        include: { items: { include: { product: true } }, payments: true },
      });

      return {
        order: updatedOrder,
        action: 'CANCELLED',
        message: 'Order reservation cancelled. Reserved stock released back to inventory.',
      };
    }

    throw new OrderStateError(`Cannot cancel or refund order with status '${order.status}'.`);
  }

  /**
   * Sweeper: Automatically release stock for expired reservations (> 5 minutes)
   */
  static async releaseExpiredReservations() {
    const now = new Date();

    const expiredOrders = await prisma.order.findMany({
      where: {
        status: OrderStatus.RESERVED,
        expiresAt: { lte: now },
      },
      include: { items: true },
    });

    if (expiredOrders.length === 0) return 0;

    let count = 0;
    for (const order of expiredOrders) {
      try {
        for (const item of order.items) {
          await prisma.$executeRaw`
            UPDATE "Product"
            SET "stock" = "stock" + ${item.quantity},
                "reservedStock" = MAX(0, "reservedStock" - ${item.quantity})
            WHERE "id" = ${item.productId}
          `;
        }

        await prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.EXPIRED },
        });

        count++;
      } catch (err) {
        console.error(`Error expiring order ${order.id}:`, err);
      }
    }

    return count;
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
