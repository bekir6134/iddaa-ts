/**
 * Railway / self-hosted cron scheduler
 * Next.js custom server gerektirir.
 * Railway'de process sürekli çalıştığı için node-cron sorunsuz çalışır.
 *
 * Kullanım: server.ts içinden import edin ve startScheduler() çağırın.
 */

import cron from 'node-cron';

let started = false;

export function startScheduler(appUrl: string, cronSecret: string) {
  if (started) return;
  started = true;

  // 0 4 * * * = Her gün 04:00 UTC = 07:00 Türkiye saati
  cron.schedule('0 4 * * *', async () => {
    console.log(`[Scheduler] Günlük veri güncelleme başlatılıyor... ${new Date().toISOString()}`);
    try {
      const res = await fetch(`${appUrl}/api/cron`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cronSecret}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      console.log(`[Scheduler] Tamamlandı:`, data);
    } catch (error) {
      console.error('[Scheduler] Hata:', error);
    }
  }, {
    timezone: 'UTC',
  });

  console.log('[Scheduler] Başlatıldı. Her gün 04:00 UTC (07:00 TR) çalışacak.');
}
