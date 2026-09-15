import { prisma } from '../prisma';
import { OrderStatus, PaymentOutcome, PaymentRequest } from '../types';
import { OrderStateError } from './order.service';

export class PaymentService {
  /**
   * Process mock payment for an order.
   * Handles SUCCESS, FAILURE, and TIMEOUT with strict transaction guarantees.
   */
  static async processPayment(data: PaymentRequest) {
    const outcome = data.simulateStatus || PaymentOutcome.SUCCESS;

    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: data.orderId },
        include: { items: true, payments: true },
      });

      if (!order) {
        throw new Error(`Order ${data.orderId} not found`);
      }

      // Idempotency: check if order is already paid
      if (order.status === OrderStatus.PAID) {
        throw new OrderStateError('Duplicate payment detected: This order has already been paid and confirmed.');
      }

      // Check for valid state
      if (order.status !== OrderStatus.RESERVED) {
        throw new OrderStateError(
          `Cannot process payment for order with status '${order.status}'. Order must be in RESERVED state.`
        );
      }

      // Check if reservation has expired
      if (order.expiresAt && order.expiresAt <= new Date()) {
        // Auto-release stock and mark expired
        for (const item of order.items) {
          await tx.$executeRaw`
            UPDATE "Product"
            SET "stock" = "stock" + ${item.quantity},
                "reservedStock" = MAX(0, "reservedStock" - ${item.quantity})
            WHERE "id" = ${item.productId}
          `;
        }

        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.EXPIRED },
        });

        throw new OrderStateError('Reservation has expired. Stock has been released back to available inventory.');
      }

      // Check duplicate idempotency key on payments
      if (data.idempotencyKey) {
        const existingTx = await tx.paymentTransaction.findFirst({
          where: { idempotencyKey: data.idempotencyKey, orderId: order.id },
        });
        if (existingTx) {
          return {
            transaction: existingTx,
            order,
            isDuplicate: true,
            message: 'Duplicate payment request processed idempotently',
          };
        }
      }

      // 1. Handle SUCCESS
      if (outcome === PaymentOutcome.SUCCESS) {
        // Stock deduction was done at reservation.
        // Confirm sale: decrement reservedStock permanently
        for (const item of order.items) {
          await tx.$executeRaw`
            UPDATE "Product"
            SET "reservedStock" = MAX(0, "reservedStock" - ${item.quantity})
            WHERE "id" = ${item.productId}
          `;
        }

        const updatedOrder = await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.PAID },
          include: { items: { include: { product: true } } },
        });

        const transaction = await tx.paymentTransaction.create({
          data: {
            orderId: order.id,
            status: PaymentOutcome.SUCCESS,
            amount: order.totalAmount,
            gatewayResponse: JSON.stringify({ code: 'PAY_SUCCESS', txId: `TXN-${Date.now()}` }),
            idempotencyKey: data.idempotencyKey || null,
          },
        });

        return {
          transaction,
          order: updatedOrder,
          outcome: PaymentOutcome.SUCCESS,
          message: 'Payment confirmed successfully. Order is PAID.',
        };
      }

      // 2. Handle FAILURE
      if (outcome === PaymentOutcome.FAILURE) {
        // Release reserved stock back to available stock immediately
        for (const item of order.items) {
          await tx.$executeRaw`
            UPDATE "Product"
            SET "stock" = "stock" + ${item.quantity},
                "reservedStock" = MAX(0, "reservedStock" - ${item.quantity})
            WHERE "id" = ${item.productId}
          `;
        }

        const updatedOrder = await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.FAILED },
          include: { items: { include: { product: true } } },
        });

        const transaction = await tx.paymentTransaction.create({
          data: {
            orderId: order.id,
            status: PaymentOutcome.FAILURE,
            amount: order.totalAmount,
            gatewayResponse: JSON.stringify({
              code: 'CARD_DECLINED',
              reason: 'Simulated payment failure (insufficient card funds or card declined)',
            }),
            idempotencyKey: data.idempotencyKey || null,
          },
        });

        return {
          transaction,
          order: updatedOrder,
          outcome: PaymentOutcome.FAILURE,
          message: 'Payment failed. Reserved stock released back to inventory.',
        };
      }

      // 3. Handle TIMEOUT
      if (outcome === PaymentOutcome.TIMEOUT) {
        // Order remains in RESERVED state; payment transaction records timeout.
        // Reservation will be automatically expired by background sweeper if not completed.
        const transaction = await tx.paymentTransaction.create({
          data: {
            orderId: order.id,
            status: PaymentOutcome.TIMEOUT,
            amount: order.totalAmount,
            gatewayResponse: JSON.stringify({
              code: 'GATEWAY_TIMEOUT',
              reason: 'Payment gateway timed out after 30s. Transaction pending verification.',
            }),
            idempotencyKey: data.idempotencyKey || null,
          },
        });

        return {
          transaction,
          order,
          outcome: PaymentOutcome.TIMEOUT,
          message:
            'Payment gateway timed out. Order remains reserved pending retry or 5-minute expiration.',
        };
      }

      throw new Error(`Unsupported payment outcome: ${outcome}`);
    });
  }
}
