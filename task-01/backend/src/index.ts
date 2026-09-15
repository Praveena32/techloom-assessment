import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.routes';
import { startReservationSweeper, stopReservationSweeper } from './workers/reservationSweeper';
import { prisma, initPrismaDatabase } from './prisma';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// CORS setup
app.use(
  cors({
    origin: '*', // Allow all origins in dev & preview
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  })
);

app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[${req.method}] ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'POS Order & Inventory System',
    timestamp: new Date().toISOString(),
  });
});

// Mount API router
app.use('/api', apiRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.url}` });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Global Error]', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// Auto-initialize DB (sets WAL mode if SQLite)
initPrismaDatabase();

if (!process.env.VERCEL) {
  const server = app.listen(PORT, async () => {
    console.log(`=================================================`);
    console.log(`🚀 POS Backend running on http://localhost:${PORT}`);
    console.log(`📦 Health check: http://localhost:${PORT}/health`);
    console.log(`📡 API Endpoints: http://localhost:${PORT}/api/products`);
    console.log(`=================================================`);

    // Start background reservation cleanup sweeper
    startReservationSweeper();
  });

  const gracefulShutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    stopReservationSweeper();
    server.close(async () => {
      await prisma.$disconnect();
      console.log('Server closed and database disconnected.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

export default app;
