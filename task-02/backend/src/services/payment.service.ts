import { prisma } from '../prisma';
import { OrderStatus, PaymentOutcome, PaymentRequest } from '../types';
import { OrderStateError } from './order.service';

export class PaymentService {
  /**
   * Process mock payment for an e-commerce checkout order.
   * Prevents duplicate payments and handles SUCCESS, FAILURE, and TIMEOUT.
   */
  static async processPayment(data: PaymentRequest) {
    const outcome = data.simulateStatus || PaymentOutcome.SUCCESS;

    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: true, payments: true },
    });

    if (!order) {
      throw new Error(`Order ${data.orderId} not found`);
    }

    // Idempotency check: If order is already PAID
    if (order.status === OrderStatus.PAID) {
      throw new OrderStateError('Duplicate payment detected: Order is already confirmed and paid.');
    }

    // Order must be in RESERVED status
    if (order.status !== OrderStatus.RESERVED) {
      throw new OrderStateError(
        `Cannot process payment for order with status '${order.status}'. Must be in RESERVED state.`
      );
    }

    // Check if reservation expired
    if (order.expiresAt && order.expiresAt <= new Date()) {
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
      throw new OrderStateError('Reservation expired before payment could be finalized. Stock released.');
    }

    // Check duplicate idempotency key
    if (data.idempotencyKey) {
      const existingTx = await prisma.paymentTransaction.findFirst({
        where: { idempotencyKey: data.idempotencyKey, orderId: order.id },
      });
      if (existingTx) {
        return {
          transaction: existingTx,
          order,
          isDuplicate: true,
          message: 'Payment request processed idempotently (duplicate suppressed).',
        };
      }
    }

    // 1. SUCCESS
    if (outcome === PaymentOutcome.SUCCESS) {
      for (const item of order.items) {
        await prisma.$executeRaw`
          UPDATE "Product"
          SET "reservedStock" = MAX(0, "reservedStock" - ${item.quantity})
          WHERE "id" = ${item.productId}
        `;
      }

      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PAID },
        include: { items: { include: { product: true } } },
      });

      const transaction = await prisma.paymentTransaction.create({
        data: {
          orderId: order.id,
          type: 'PAYMENT',
          status: PaymentOutcome.SUCCESS,
          amount: order.totalAmount,
          gatewayResponse: JSON.stringify({
            code: 'AUTHORIZATION_SUCCESS',
            authCode: `AUTH-${Date.now()}`,
            cardLast4: '4242',
          }),
          idempotencyKey: data.idempotencyKey || null,
        },
      });

      return {
        transaction,
        order: updatedOrder,
        outcome: PaymentOutcome.SUCCESS,
        message: 'Payment authorized and captured. Order confirmed!',
      };
    }

    // 2. FAILURE
    if (outcome === PaymentOutcome.FAILURE) {
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
        data: { status: OrderStatus.FAILED },
        include: { items: { include: { product: true } } },
      });

      const transaction = await prisma.paymentTransaction.create({
        data: {
          orderId: order.id,
          type: 'PAYMENT',
          status: PaymentOutcome.FAILURE,
          amount: order.totalAmount,
          gatewayResponse: JSON.stringify({
            code: 'CARD_DECLINED',
            reason: 'Simulated failure: Insufficient funds or invalid card details.',
          }),
          idempotencyKey: data.idempotencyKey || null,
        },
      });

      return {
        transaction,
        order: updatedOrder,
        outcome: PaymentOutcome.FAILURE,
        message: 'Payment declined. Reserved stock has been returned to the store.',
      };
    }

    // 3. TIMEOUT
    if (outcome === PaymentOutcome.TIMEOUT) {
      const transaction = await prisma.paymentTransaction.create({
        data: {
          orderId: order.id,
          type: 'PAYMENT',
          status: PaymentOutcome.TIMEOUT,
          amount: order.totalAmount,
          gatewayResponse: JSON.stringify({
            code: 'GATEWAY_TIMEOUT',
            reason: 'Payment gateway timed out after 30 seconds. Pending verification.',
          }),
          idempotencyKey: data.idempotencyKey || null,
        },
      });

      return {
        transaction,
        order,
        outcome: PaymentOutcome.TIMEOUT,
        message: 'Payment gateway timed out. Order remains reserved pending retry or 5-min timeout.',
      };
    }

    throw new Error(`Unsupported outcome: ${outcome}`);
  }
}
