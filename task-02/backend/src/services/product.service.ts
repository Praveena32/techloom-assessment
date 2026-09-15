import { prisma } from '../prisma';
import { ProductQueryParams } from '../types';

export class ProductService {
  /**
   * Search and filter products
   */
  static async getProducts(params: ProductQueryParams) {
    const { q, category, minPrice, maxPrice, inStock, sort } = params;

    const where: any = {};

    // Keyword search in name or description
    if (q && q.trim()) {
      where.OR = [
        { name: { contains: q.trim() } },
        { description: { contains: q.trim() } },
      ];
    }

    // Category filter
    if (category && category !== 'ALL') {
      where.category = category;
    }

    // Price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = Number(minPrice);
      if (maxPrice !== undefined) where.price.lte = Number(maxPrice);
    }

    // Availability filter
    if (inStock === true) {
      where.stock = { gt: 0 };
    }

    // Sorting
    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'price_asc') orderBy = { price: 'asc' };
    if (sort === 'price_desc') orderBy = { price: 'desc' };
    if (sort === 'rating') orderBy = { rating: 'desc' };
    if (sort === 'newest') orderBy = { createdAt: 'desc' };

    const products = await prisma.product.findMany({
      where,
      orderBy,
    });

    return products.map((p) => ({
      ...p,
      specs: p.specs ? JSON.parse(p.specs) : null,
      isOutOfStock: p.stock <= 0,
      totalPhysicalStock: p.stock + p.reservedStock,
    }));
  }

  static async getProductById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) return null;

    return {
      ...product,
      specs: product.specs ? JSON.parse(product.specs) : null,
      isOutOfStock: product.stock <= 0,
      totalPhysicalStock: product.stock + product.reservedStock,
    };
  }

  static async getCategories() {
    const categories = await prisma.product.findMany({
      select: { category: true },
      distinct: ['category'],
    });
    return ['ALL', ...categories.map((c) => c.category)];
  }
}
