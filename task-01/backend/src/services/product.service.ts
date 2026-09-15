import { prisma } from '../prisma';

export interface CreateProductDTO {
  name: string;
  description?: string;
  price: number;
  stock: number;
  category?: string;
}

export interface UpdateProductDTO {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  category?: string;
}

export class ProductService {
  static async getAllProducts() {
    return prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getProductById(id: string) {
    return prisma.product.findUnique({
      where: { id },
    });
  }

  static async createProduct(data: CreateProductDTO) {
    return prisma.product.create({
      data: {
        name: data.name,
        description: data.description || '',
        price: data.price,
        stock: data.stock,
        reservedStock: 0,
        category: data.category || 'General',
      },
    });
  }

  static async updateProduct(id: string, data: UpdateProductDTO) {
    return prisma.product.update({
      where: { id },
      data,
    });
  }

  static async deleteProduct(id: string) {
    return prisma.product.delete({
      where: { id },
    });
  }

  static async getStockLevels() {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        stock: true,
        reservedStock: true,
        price: true,
      },
    });

    return products.map((p) => ({
      ...p,
      totalPhysicalStock: p.stock + p.reservedStock,
      availableStock: p.stock,
      reservedStock: p.reservedStock,
      isOutOfStock: p.stock <= 0,
    }));
  }
}
