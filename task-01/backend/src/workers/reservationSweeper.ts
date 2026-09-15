import { OrderService } from '../services/order.service';

let sweeperInterval: NodeJS.Timeout | null = null;

export function startReservationSweeper() {
  const intervalSeconds = parseInt(process.env.SWEEPER_INTERVAL_SECONDS || '5', 10);
  console.log(`[Sweeper] Starting reservation cleanup worker (interval: ${intervalSeconds}s)...`);

  sweeperInterval = setInterval(async () => {
    try {
      const releasedCount = await OrderService.releaseExpiredReservations();
      if (releasedCount > 0) {
        console.log(`[Sweeper] Auto-released stock for ${releasedCount} expired order(s).`);
      }
    } catch (err) {
      console.error('[Sweeper] Error in reservation cleanup cycle:', err);
    }
  }, intervalSeconds * 1000);
}

export function stopReservationSweeper() {
  if (sweeperInterval) {
    clearInterval(sweeperInterval);
    sweeperInterval = null;
    console.log('[Sweeper] Stopped reservation cleanup worker.');
  }
}
