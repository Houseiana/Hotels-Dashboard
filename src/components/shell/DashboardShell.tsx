'use client';

import { useState, type ReactNode } from 'react';
import { MobileSidebar, Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function DashboardShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <MobileSidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenNav={() => setNavOpen(true)} />
        {/* Wide by default — the cap only stops content sprawling on ultrawide
            displays, it should not leave gutters on a normal laptop. */}
        <main className="mx-auto w-full max-w-[1720px] flex-1 px-4 py-6 sm:px-6 sm:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}
