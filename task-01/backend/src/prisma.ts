import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'test' ? [] : ['warn', 'error'],
});

export async function initPrismaDatabase() {
  try {
    const url = process.env.DATABASE_URL || '';
    if (url.startsWith('file:') || !url.startsWith('postgres')) {
      await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
      await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 30000;');
      await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
      console.log('✅ SQLite WAL mode and 30s busy_timeout configured.');
    }
  } catch (err) {
    console.warn('Could not set PRAGMA:', err);
  }
}
