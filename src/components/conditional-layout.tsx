'use client';

import { useState, useEffect, useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { CommandPalette } from '@/components/command-palette';

export function ConditionalLayout({ children, sidebarOpen }: { children: React.ReactNode; sidebarOpen: boolean }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(sidebarOpen);
  const isStandalone = pathname === '/login';

  // Persist to cookie + localStorage on change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("hermy_sidebar_open", String(isSidebarOpen));
      document.cookie = `hermy_sidebar_open=${isSidebarOpen ? "true" : "false"}; path=/; max-age=${60*60*24*365}; SameSite=Lax`;
    }
  }, [isSidebarOpen]);

  // Mobile: auto-close on mount (doesn't persist — responsive, not a preference)
  useLayoutEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      requestAnimationFrame(() => setIsSidebarOpen(false));
    }
  }, []);

  if (isStandalone) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen">
      <div className="hq-ambient" aria-hidden />
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <main className="relative flex-1 overflow-auto pt-16 lg:pt-0 pb-20 lg:pb-0 px-4 sm:px-6 md:px-10 lg:px-12 py-4 md:py-8 page-enter transition-all duration-300 ease-in-out">
        <div className="pb-safe relative">
          {children}
        </div>
      </main>
      <CommandPalette />
    </div>
  );
}
