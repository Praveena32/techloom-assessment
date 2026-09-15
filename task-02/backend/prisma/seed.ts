import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding e-commerce store catalog...');

  await prisma.orderItem.deleteMany();
  await prisma.paymentTransaction.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();

  const products = [
    {
      name: 'Aura Pro Active Noise-Cancelling Headphones',
      description: 'Studio-fidelity wireless audio with 40-hour battery life, spatial audio, and adaptive hybrid noise cancellation.',
      price: 349.99,
      stock: 12,
      reservedStock: 0,
      category: 'Audio',
      imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
      rating: 4.9,
      specs: JSON.stringify({
        driver: '40mm Titanium Dome',
        battery: '40 Hours Playtime',
        connectivity: 'Bluetooth 5.3 + 3.5mm Aux',
        weight: '250g',
      }),
    },
    {
      name: 'Zenith OLED Smartwatch Ultra 49mm',
      description: 'Aerospace-grade titanium case with sapphire crystal glass, ECG sensor, GPS dual-frequency, and 100m water resistance.',
      price: 499.00,
      stock: 8,
      reservedStock: 0,
      category: 'Wearables',
      imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
      rating: 4.8,
      specs: JSON.stringify({
        display: '1.92" LTPO OLED (2000 nits)',
        sensors: 'ECG, SpO2, Heart Rate, Depth Sensor',
        waterResistance: '100m / IP6X',
        battery: '60 Hours Standard / 100 Low Power',
      }),
    },
    {
      name: 'Vortex Mechanical Gaming Keyboard RGB',
      description: 'Hot-swappable custom linear switches, CNC aluminum chassis, sound-dampening silicone foam, and per-key RGB backlighting.',
      price: 159.50,
      stock: 20,
      reservedStock: 0,
      category: 'Gaming',
      imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80',
      rating: 4.7,
      specs: JSON.stringify({
        layout: '75% Compact Layout',
        switches: 'Gateron Pre-lubed Linear',
        connectivity: 'Tri-Mode (2.4Ghz, BT, USB-C)',
        keycaps: 'Double-shot PBT Cherry Profile',
      }),
    },
    {
      name: 'AeroBook 14" M3 Ultralight Laptop',
      description: 'Stunning Liquid Retina display, 18-hour all-day battery, 16GB unified memory, and silent fanless aluminum unibody.',
      price: 1299.00,
      stock: 4, // Limited stock for testing reservation
      reservedStock: 0,
      category: 'Laptops',
      imageUrl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80',
      rating: 5.0,
      specs: JSON.stringify({
        processor: '10-Core SoC Processor',
        memory: '16GB Unified RAM',
        storage: '512GB NVMe PCIe Gen4',
        display: '14.2" 3024x1964 120Hz ProMotion',
      }),
    },
    {
      name: 'Nebula 4K Cinema Pocket Drone',
      description: 'Foldable lightweight drone with 3-axis motorized gimbal, 4K/60fps HDR video, 10km transmission range, and obstacle sensing.',
      price: 749.99,
      stock: 6,
      reservedStock: 0,
      category: 'Cameras',
      imageUrl: 'https://images.unsplash.com/photo-1527977966376-1c8408f9f108?w=800&q=80',
      rating: 4.8,
      specs: JSON.stringify({
        camera: '1/1.3" CMOS 48MP Sensor',
        flightTime: '38 Minutes per Battery',
        weight: '249g (No registration needed)',
        maxSpeed: '16 m/s',
      }),
    },
    {
      name: 'Lumina Ergonomic Wireless Mouse',
      description: 'Precision 26,000 DPI optical sensor, ultra-quiet silent clicks, ergonomic thumb rest, and hyper-fast magspeed scroll wheel.',
      price: 89.00,
      stock: 18,
      reservedStock: 0,
      category: 'Accessories',
      imageUrl: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&q=80',
      rating: 4.6,
      specs: JSON.stringify({
        sensor: 'Optical Darkfield 26K DPI',
        battery: 'Rechargeable 70 Days',
        multiDevice: 'Connect up to 3 devices',
        weight: '141g',
      }),
    },
    {
      name: 'Pulse Studio Wireless Smart Speaker',
      description: '360-degree room-filling acoustic audio with integrated voice assistant, AirPlay 2, multi-room sync, and warm ambient light ring.',
      price: 199.00,
      stock: 14,
      reservedStock: 0,
      category: 'Audio',
      imageUrl: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&q=80',
      rating: 4.7,
      specs: JSON.stringify({
        output: '65W Peak Amplification',
        connectivity: 'Wi-Fi 6, BT 5.2, AirPlay 2',
        microphones: 'Quad Far-field Array',
        dimensions: '160 x 160 x 180 mm',
      }),
    },
    {
      name: 'Titan Gaming Desktop RTX 4080',
      description: 'Liquid-cooled gaming rig featuring 14th Gen i9, 32GB DDR5, 2TB SSD, and GeForce RTX 4080 16GB graphics card.',
      price: 2499.00,
      stock: 2, // Ultra limited stock
      reservedStock: 0,
      category: 'Gaming',
      imageUrl: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&q=80',
      rating: 4.9,
      specs: JSON.stringify({
        gpu: 'NVIDIA GeForce RTX 4080 16GB',
        cpu: 'Intel Core i9-14900K 24-Cores',
        ram: '32GB DDR5 6000MHz RGB',
        cooling: '360mm AIO Liquid Cooler',
      }),
    },
  ];

  for (const p of products) {
    const created = await prisma.product.create({ data: p });
    console.log(`Created product: ${created.name} ($${created.price}, Stock: ${created.stock})`);
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
