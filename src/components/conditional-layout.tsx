'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { CommandPalette } from '@/components/command-palette';

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const isStandalone = pathname === '/login';

  // Persistence logic: Load from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('hermy_sidebar_open');
    if (savedState !== null) {
      setIsSidebarOpen(savedState === 'true');
    } else if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

  // Persistence logic: Save to localStorage on change
  useEffect(() => {
    localStorage.setItem('hermy_sidebar_open', String(isSidebarOpen));
  }, [isSidebarOpen]);

  if (isStandalone) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen">
      <div className="hq-ambient" aria-hidden />
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <main className="relative flex-1 overflow-auto pt-14 lg:pt-0 pb-20 lg:pb-0 px-4 sm:px-6 md:px-10 lg:px-12 py-4 md:py-8 page-enter transition-all duration-300 ease-in-out">
        <div className="pb-safe relative">
          {children}
        </div>
      </main>
      <CommandPalette />
    </div>
  );
}
