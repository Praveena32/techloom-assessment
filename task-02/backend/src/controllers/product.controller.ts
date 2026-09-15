import { Request, Response } from 'express';
import { ProductService } from '../services/product.service';

export class ProductController {
  static async getProducts(req: Request, res: Response) {
    try {
      const { q, category, minPrice, maxPrice, inStock, sort } = req.query;

      const products = await ProductService.getProducts({
        q: q ? String(q) : undefined,
        category: category ? String(category) : undefined,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        inStock: inStock === 'true',
        sort: sort as any,
      });

      res.json({ success: true, count: products.length, data: products });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getProductById(req: Request, res: Response) {
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

  static async getCategories(req: Request, res: Response) {
    try {
      const categories = await ProductService.getCategories();
      res.json({ success: true, data: categories });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
