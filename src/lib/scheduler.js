"use strict";
/**
 * Railway / self-hosted cron scheduler
 * Next.js custom server gerektirir.
 * Railway'de process sürekli çalıştığı için node-cron sorunsuz çalışır.
 *
 * Kullanım: server.ts içinden import edin ve startScheduler() çağırın.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScheduler = startScheduler;
const node_cron_1 = __importDefault(require("node-cron"));
let started = false;
function startScheduler(appUrl, cronSecret) {
    if (started)
        return;
    started = true;
    // 0 4 * * * = Her gün 04:00 UTC = 07:00 Türkiye saati
    node_cron_1.default.schedule('0 4 * * *', async () => {
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
        }
        catch (error) {
            console.error('[Scheduler] Hata:', error);
        }
    }, {
        timezone: 'UTC',
    });
    console.log('[Scheduler] Başlatıldı. Her gün 04:00 UTC (07:00 TR) çalışacak.');
}
