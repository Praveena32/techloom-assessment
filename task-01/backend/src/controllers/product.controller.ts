import { Request, Response } from 'express';
import { ProductService } from '../services/product.service';
import { z } from 'zod';

const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  price: z.number().positive('Price must be greater than 0'),
  stock: z.number().int().nonnegative('Stock cannot be negative'),
  category: z.string().optional(),
});

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  stock: z.number().int().nonnegative().optional(),
  category: z.string().optional(),
});

export class ProductController {
  static async getAll(req: Request, res: Response) {
    try {
      const products = await ProductService.getAllProducts();
      res.json({ success: true, data: products });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const product = await ProductService.getProductById(id);
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }
      res.json({ success: true, data: product });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const validated = createProductSchema.parse(req.body);
      const product = await ProductService.createProduct(validated);
      res.status(201).json({ success: true, data: product });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: error.errors[0].message });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const validated = updateProductSchema.parse(req.body);
      const product = await ProductService.updateProduct(id, validated);
      res.json({ success: true, data: product });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: error.errors[0].message });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      await ProductService.deleteProduct(id);
      res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getStockLevels(req: Request, res: Response) {
    try {
      const stock = await ProductService.getStockLevels();
      res.json({ success: true, data: stock });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
