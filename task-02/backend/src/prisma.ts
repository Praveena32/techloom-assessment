import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:')) {
    return process.env.DATABASE_URL;
  }

  // On Vercel Serverless, the filesystem is read-only except for /tmp
  if (process.env.VERCEL) {
    const tmpDb = '/tmp/dev.db';
    const possiblePaths = [
      path.join(process.cwd(), 'prisma', 'dev.db'),
      path.join(process.cwd(), 'dev.db'),
      path.join(__dirname, '..', 'prisma', 'dev.db'),
      path.join(__dirname, '..', '..', 'prisma', 'dev.db'),
    ];

    if (!fs.existsSync(tmpDb)) {
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          try {
            fs.copyFileSync(p, tmpDb);
            console.log(`[Prisma] Copied database from ${p} to ${tmpDb}`);
            break;
          } catch (e) {
            console.warn('[Prisma] Error copying to /tmp:', e);
          }
        }
      }
    }

    return `file:${tmpDb}`;
  }

  return process.env.DATABASE_URL || 'file:./dev.db';
}

const dbUrl = getDatabaseUrl();
process.env.DATABASE_URL = dbUrl;

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
  log: process.env.NODE_ENV === 'test' ? [] : ['warn', 'error'],
});

export async function initPrismaDatabase() {
  try {
    const url = dbUrl;
    if (url.startsWith('file:') || !url.startsWith('postgres')) {
      await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
      await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 30000;');
      await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
      console.log('✅ SQLite WAL mode configured for Storefront.');
    }
  } catch (err) {
    console.warn('Could not set PRAGMA:', err);
  }
}
