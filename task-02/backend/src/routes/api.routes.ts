import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { OrderController } from '../controllers/order.controller';
import { PaymentController } from '../controllers/payment.controller';

const router = Router();

// Product Discovery routes
router.get('/products', ProductController.getProducts);
router.get('/products/categories', ProductController.getCategories);
router.get('/products/:id', ProductController.getProductById);

// Cart & Checkout routes
router.post('/orders/checkout', OrderController.checkout);
router.get('/orders', OrderController.getAll);
router.get('/orders/:id', OrderController.getById);
router.post('/orders/:id/cancel', OrderController.cancelOrRefund);

// Mock Payment Gateway routes
router.post('/payments/process', PaymentController.process);

export default router;
