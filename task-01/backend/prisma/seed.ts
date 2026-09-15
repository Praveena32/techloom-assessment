import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial POS products...');

  await prisma.orderItem.deleteMany();
  await prisma.paymentTransaction.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();

  const products = [
    {
      name: 'Wireless Barcode Scanner 2D',
      description: 'Ultra-fast handheld Bluetooth POS barcode scanner',
      price: 129.99,
      stock: 15,
      reservedStock: 0,
      category: 'Hardware',
    },
    {
      name: 'Thermal Receipt Paper (Box of 50)',
      description: '80mm x 80m premium BPA-free thermal receipt rolls',
      price: 49.50,
      stock: 30,
      reservedStock: 0,
      category: 'Supplies',
    },
    {
      name: 'Limited Edition Smart POS Terminal',
      description: 'High-speed quad-core merchant terminal with EMV chip reader',
      price: 299.00,
      stock: 5, // Ideal for concurrency stress test!
      reservedStock: 0,
      category: 'Hardware',
    },
    {
      name: 'Heavy Duty Cash Drawer RJ12',
      description: 'Steel construction 5 bills 8 coins with key lock',
      price: 89.95,
      stock: 10,
      reservedStock: 0,
      category: 'Hardware',
    },
    {
      name: 'Touchscreen Customer Display',
      description: '10.1 inch secondary display for customer checkout and signature',
      price: 179.00,
      stock: 8,
      reservedStock: 0,
      category: 'Hardware',
    },
    {
      name: 'POS Magnetic Stripe Reader',
      description: 'USB 3-track credit card swiper with encrypted head',
      price: 34.50,
      stock: 25,
      reservedStock: 0,
      category: 'Peripherals',
    },
  ];

  for (const p of products) {
    const created = await prisma.product.create({ data: p });
    console.log(`Created product: ${created.name} (Stock: ${created.stock})`);
  }

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
