'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { OSModuleRail } from './os-module-rail';
import { OSSubNavPanel } from './os-subnav-panel';
import { OSBottomNav } from './os-bottom-nav';
import { AppHeader } from './app-header';
import { ChatWidget } from '@/components/chat';
import { OS_MODULES, getModuleByRoute, type ModuleId } from '@/lib/os-modules';
import { cn } from '@/lib/utils';

export function OSShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSubNavOpen, setIsSubNavOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<ModuleId>('kindicore');

  // Sync active module with current route
  useEffect(() => {
    const mod = getModuleByRoute(pathname);
    if (mod && mod.id !== activeModule) {
      setActiveModule(mod.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Open subnav on desktop on mount if needed
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      setIsSubNavOpen(true);
    }
  }, []);

  // Track chat sidebar state
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ isOpen: boolean }>).detail;
      setIsChatOpen(detail.isOpen);
    };
    window.addEventListener('kindicore-chat-sidebar-toggle', handler);
    return () => window.removeEventListener('kindicore-chat-sidebar-toggle', handler);
  }, []);

  const handleModuleChange = useCallback(
    (id: ModuleId) => {
      if (id === activeModule) {
        // Toggle subnav when clicking same module
        setIsSubNavOpen(v => !v);
      } else {
        setActiveModule(id);
        setIsSubNavOpen(true);
        const mod = OS_MODULES.find(m => m.id === id);
        if (mod) router.push(mod.href);
      }
    },
    [activeModule, router],
  );

  const currentMod = OS_MODULES.find(m => m.id === activeModule);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* ── Level 1: Module Rail (Desktop) ── */}
      <div className="hidden md:flex flex-col">
        <OSModuleRail activeModule={activeModule} onModuleChange={handleModuleChange} />
      </div>

      {/* ── Level 2: Sub-Navigation Slide (Desktop & Mobile Drawer) ── */}
      <OSSubNavPanel
        activeModule={activeModule}
        isOpen={isSubNavOpen}
        onClose={() => setIsSubNavOpen(false)}
        onNavigate={() => {
          if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setIsSubNavOpen(false);
          }
        }}
      />

      {/* ── Level 3: Main Canvas ── */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Module accent top line */}
        {currentMod && (
          <div
            className="h-[2px] shrink-0 transition-all duration-500"
            style={{
              background: `linear-gradient(90deg, transparent, ${currentMod.color}80, transparent)`,
            }}
          />
        )}

        {/* Header */}
        <AppHeader />

        {/* Content Canvas */}
        <main
          className={cn(
            'flex-1 overflow-y-auto',
            'pb-4 md:pb-0 mb-16 md:mb-0',
          )}
        >
          <div className="p-4 lg:p-6 min-h-full">{children}</div>
        </main>
      </div>

      {/* ── Mobile Bottom Navigation ── */}
      <OSBottomNav
        activeModule={activeModule}
        onModuleChange={handleModuleChange}
        isSubNavOpen={isSubNavOpen}
        onToggleSubNav={() => setIsSubNavOpen(v => !v)}
      />

      {/* ── Global Copilot Console ── */}
      <ChatWidget />
    </div>
  );
}
