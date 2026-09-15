import { Request, Response } from 'express';
import { OrderService, InsufficientStockError, OrderStateError } from '../services/order.service';
import { z } from 'zod';

const checkoutSchema = z.object({
  customerName: z.string().optional(),
  idempotencyKey: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string().min(1, 'Product ID is required'),
      quantity: z.number().int().positive('Quantity must be at least 1'),
    })
  ).min(1, 'At least one item is required in the cart'),
});

export class OrderController {
  static async checkout(req: Request, res: Response) {
    try {
      const validated = checkoutSchema.parse(req.body);
      const idempotencyKey = (req.headers['idempotency-key'] as string) || validated.idempotencyKey;

      const result = await OrderService.createReservation({
        ...validated,
        idempotencyKey,
      });

      if (result.isExisting) {
        return res.status(200).json({
          success: true,
          isDuplicate: true,
          message: 'Order retrieved via idempotency key',
          data: result.order,
        });
      }

      res.status(201).json({
        success: true,
        message: 'Stock reserved successfully for 5 minutes',
        data: result.order,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: error.errors[0].message });
      }
      if (error instanceof InsufficientStockError) {
        return res.status(409).json({ success: false, error: error.message });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async cancel(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { reason } = req.body;
      const cancelledOrder = await OrderService.cancelOrder(id, reason);
      res.json({
        success: true,
        message: 'Order cancelled successfully and reserved stock restored',
        data: cancelledOrder,
      });
    } catch (error: any) {
      if (error instanceof OrderStateError) {
        return res.status(400).json({ success: false, error: error.message });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getAll(req: Request, res: Response) {
    try {
      const orders = await OrderService.getAllOrders();
      res.json({ success: true, data: orders });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const order = await OrderService.getOrderById(id);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }
      res.json({ success: true, data: order });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
