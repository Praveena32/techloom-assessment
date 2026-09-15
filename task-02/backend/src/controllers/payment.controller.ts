import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { OrderStateError } from '../services/order.service';
import { z } from 'zod';

const processPaymentSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  simulateStatus: z.enum(['SUCCESS', 'FAILURE', 'TIMEOUT']).optional().default('SUCCESS'),
  idempotencyKey: z.string().optional(),
});

export class PaymentController {
  static async process(req: Request, res: Response) {
    try {
      const validated = processPaymentSchema.parse(req.body);
      const idempotencyKey = (req.headers['idempotency-key'] as string) || validated.idempotencyKey;

      const result = await PaymentService.processPayment({
        ...validated,
        idempotencyKey,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: error.errors[0].message });
      }
      if (error instanceof OrderStateError) {
        return res.status(409).json({ success: false, error: error.message });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
