import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getCacheMeta } from '@/lib/data-cache';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const metadata: Metadata = {
  title: 'İddaa Analiz | Maç Tahminleri ve Oran Analizi',
  description: 'Günlük iddaa maçları için yapay zeka destekli tahminler, oran analizi, sakatlık takibi ve akıllı kupon oluşturucu.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let lastUpdated: string | undefined;
  try {
    const meta = await getCacheMeta();
    lastUpdated = meta.lastUpdated || undefined;
  } catch {
    // Cache henüz yok
  }

  return (
    <html lang="tr" className={`${geist.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">
        <QueryProvider>
          <TooltipProvider>
            <Navbar />
            <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-6">
              {children}
            </main>
            <Footer lastUpdated={lastUpdated} />
          </TooltipProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
