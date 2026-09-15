import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { OrderController } from '../controllers/order.controller';
import { PaymentController } from '../controllers/payment.controller';
import { ConcurrencyTestController } from '../controllers/concurrencyTest.controller';

const router = Router();

// Product & Inventory Routes
router.get('/products', ProductController.getAll);
router.get('/products/stock', ProductController.getStockLevels);
router.get('/products/:id', ProductController.getById);
router.post('/products', ProductController.create);
router.put('/products/:id', ProductController.update);
router.delete('/products/:id', ProductController.delete);

// Cart & Order Routes
router.post('/orders/checkout', OrderController.checkout);
router.get('/orders', OrderController.getAll);
router.get('/orders/:id', OrderController.getById);
router.post('/orders/:id/cancel', OrderController.cancel);

// Mock Payment Routes
router.post('/payments/process', PaymentController.process);

// Concurrency Benchmark Route
router.post('/test/concurrency', ConcurrencyTestController.runTest);

export default router;
