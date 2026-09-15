import { OrderService } from '../services/order.service';

let sweeperInterval: NodeJS.Timeout | null = null;

export function startReservationSweeper() {
  const intervalSeconds = parseInt(process.env.SWEEPER_INTERVAL_SECONDS || '15', 10);
  console.log(`[Sweeper] Starting Storefront reservation cleaner (every ${intervalSeconds}s)...`);

  sweeperInterval = setInterval(async () => {
    try {
      const released = await OrderService.releaseExpiredReservations();
      if (released > 0) {
        console.log(`[Sweeper] Released stock for ${released} expired storefront orders.`);
      }
    } catch (err) {
      console.error('[Sweeper] Storefront reservation cleanup error:', err);
    }
  }, intervalSeconds * 1000);
}

export function stopReservationSweeper() {
  if (sweeperInterval) {
    clearInterval(sweeperInterval);
    sweeperInterval = null;
  }
}
