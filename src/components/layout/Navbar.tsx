'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Calendar, TrendingUp, AlertCircle, Trophy, Ticket, Download, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';

const navLinks = [
  { href: '/', label: 'Dashboard', icon: BarChart3 },
  { href: '/mac-analizi', label: 'Maç Analizi', icon: Calendar },
  { href: '/oran-analizi', label: 'Oran Analizi', icon: TrendingUp },
  { href: '/injuries', label: 'Sakatlıklar', icon: AlertCircle },
  { href: '/lig-tablolari', label: 'Lig Tabloları', icon: Trophy },
  { href: '/kupon', label: 'Kupon', icon: Ticket },
  { href: '/istatistikler', label: 'İstatistikler', icon: BarChart3 },
];

function NavLink({ href, label, icon: Icon, onClick }: { href: string; label: string; icon: React.ElementType; onClick?: () => void }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
        active
          ? 'bg-emerald-600 text-white'
          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
      )}
    >
      <Icon size={16} />
      {label}
    </Link>
  );
}

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-slate-900 border-b border-slate-700">
      <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <Trophy size={18} className="text-white" />
          </div>
          <span className="font-bold text-white text-lg hidden sm:block">İddaa Analiz</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
          {navLinks.map((link) => (
            <NavLink key={link.href} {...link} />
          ))}
        </nav>

        {/* Excel download button */}
        <a href="/api/download" download className="shrink-0">
          <Button size="sm" variant="outline" className="border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white hidden sm:flex gap-2">
            <Download size={14} />
            Excel İndir
          </Button>
        </a>

        {/* Mobile hamburger */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger>
            <Button variant="ghost" size="icon" className="lg:hidden text-slate-300">
              <Menu size={20} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="bg-slate-900 border-slate-700 w-64 p-4">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                <Trophy size={18} className="text-white" />
              </div>
              <span className="font-bold text-white text-lg">İddaa Analiz</span>
            </div>
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <NavLink key={link.href} {...link} onClick={() => setOpen(false)} />
              ))}
              <div className="mt-4 pt-4 border-t border-slate-700">
                <a href="/api/download" download>
                  <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-500 gap-2">
                    <Download size={14} />
                    Excel İndir
                  </Button>
                </a>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
