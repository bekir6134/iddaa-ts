/**
 * Custom Next.js server — Railway deployment için
 * package.json "start" scriptini: "node server.js" olarak ayarlayın
 * (next build sonrası otomatik compile edilir)
 */

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { startScheduler } from './src/lib/scheduler';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT ?? '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Request handler hatası:', err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  }).listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);

    // Railway'de cron başlat
    if (!dev) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `http://localhost:${port}`;
      const cronSecret = process.env.CRON_SECRET ?? '';
      if (cronSecret) {
        startScheduler(appUrl, cronSecret);
      } else {
        console.warn('[Scheduler] CRON_SECRET tanımlı değil, scheduler başlatılmadı.');
      }
    }
  });
});
