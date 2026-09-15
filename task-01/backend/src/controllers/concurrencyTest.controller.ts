import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { OrderService, InsufficientStockError } from '../services/order.service';

export class ConcurrencyTestController {
  /**
   * Endpoint to run an in-process concurrency simulation of 50 simultaneous checkout requests
   * against a single product with limited stock (e.g. 5 units).
   */
  static async runTest(req: Request, res: Response) {
    try {
      const initialStock = req.body.initialStock || 5;
      const totalRequests = req.body.totalRequests || 50;

      // 1. Create a dedicated test product for concurrency testing
      const testProduct = await prisma.product.create({
        data: {
          name: `Concurrency Stress Item [${Date.now()}]`,
          description: 'Created dynamically for concurrent load verification',
          price: 99.99,
          stock: initialStock,
          reservedStock: 0,
          category: 'Benchmark',
        },
      });

      console.log(`[ConcurrencyTest] Initiating test: ${totalRequests} simultaneous requests for ${initialStock} items...`);

      const startTime = Date.now();
      const results: Array<{
        index: number;
        success: boolean;
        statusCode: number;
        orderNumber?: string;
        message: string;
      }> = [];

      // 2. Prepare 50 simultaneous checkout requests
      const requestPromises = Array.from({ length: totalRequests }).map(async (_, idx) => {
        try {
          const outcome = await OrderService.createReservation({
            customerName: `Concurrent Buyer #${idx + 1}`,
            items: [{ productId: testProduct.id, quantity: 1 }],
          });

          return {
            index: idx + 1,
            success: true,
            statusCode: 201,
            orderNumber: outcome.order.orderNumber,
            message: 'Stock successfully reserved',
          };
        } catch (err: any) {
          if (err instanceof InsufficientStockError) {
            return {
              index: idx + 1,
              success: false,
              statusCode: 409,
              message: err.message,
            };
          }
          return {
            index: idx + 1,
            success: false,
            statusCode: 500,
            message: err.message,
          };
        }
      });

      // 3. Execute all requests simultaneously with Promise.all
      const resolvedResults = await Promise.all(requestPromises);
      const durationMs = Date.now() - startTime;

      // 4. Check final stock in the database
      const finalProduct = await prisma.product.findUnique({
        where: { id: testProduct.id },
      });

      const successCount = resolvedResults.filter((r) => r.success).length;
      const rejectedCount = resolvedResults.filter((r) => !r.success && r.statusCode === 409).length;
      const errorCount = resolvedResults.filter((r) => !r.success && r.statusCode !== 409).length;

      const oversellingOccurred = (finalProduct?.stock ?? 0) < 0 || successCount > initialStock;

      res.json({
        success: true,
        testSummary: {
          productId: testProduct.id,
          productName: testProduct.name,
          initialStock,
          totalConcurrentRequests: totalRequests,
          successfulReservations: successCount,
          rejectedDueToOutOfStock: rejectedCount,
          unexpectedErrors: errorCount,
          finalAvailableStock: finalProduct?.stock,
          finalReservedStock: finalProduct?.reservedStock,
          executionTimeMs: durationMs,
          oversellingOccurred,
          verdict:
            !oversellingOccurred && successCount === initialStock && rejectedCount === (totalRequests - initialStock)
              ? 'PASSED - 100% Concurrency Safe (Zero Overselling)'
              : 'FAILED - Race condition detected',
        },
        sampleRequests: resolvedResults.slice(0, 15), // send first 15 for inspection
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
