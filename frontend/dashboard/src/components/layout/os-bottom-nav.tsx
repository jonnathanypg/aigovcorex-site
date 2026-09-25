'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { OS_MODULES, type ModuleId } from '@/lib/os-modules';
import { authService } from '@/services/auth.service';
import { useLicense } from '@/contexts/license-context';

interface OSBottomNavProps {
  activeModule: ModuleId;
  onModuleChange: (id: ModuleId) => void;
  isSubNavOpen?: boolean;
  onToggleSubNav?: () => void;
}

export function OSBottomNav({ activeModule, onModuleChange, isSubNavOpen, onToggleSubNav }: OSBottomNavProps) {
  const [userRole, setUserRole] = useState<string>('');
  const { hasModule } = useLicense();

  useEffect(() => {
    const user = authService.getStoredUser();
    if (user) {
      const roleName = typeof user.role === 'string' ? user.role : (user.role as any)?.name;
      setUserRole(roleName);
    }
  }, []);

  const visibleModules = OS_MODULES.filter(m =>
    (!userRole || m.requiredRoles.includes(userRole)) && hasModule(m.id)
  ).slice(0, 5);

  return (
    <nav className="os-bottom-nav fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2 py-2 md:hidden">
      {visibleModules.map((mod) => {
        const Icon = mod.icon;
        const isActive = activeModule === mod.id;

        const isSubOpenForThis = isActive && isSubNavOpen;

        return (
          <button
            key={mod.id}
            onClick={() => {
              if (isActive && onToggleSubNav) {
                onToggleSubNav();
              } else {
                onModuleChange(mod.id);
              }
            }}
            className={cn(
              'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-200 flex-1 max-w-[80px] relative',
              isActive ? 'opacity-100' : 'opacity-60 hover:opacity-100',
            )}
            style={isActive ? { background: `${mod.color}20` } : {}}
            title={isActive ? `${mod.label} (Toca para ver submenús)` : mod.label}
          >
            <div className="relative flex items-center justify-center">
              <Icon
                className="w-5 h-5 transition-transform duration-200"
                style={{
                  color: isActive ? mod.color : 'currentColor',
                  transform: isSubOpenForThis ? 'scale(1.1)' : 'scale(1)'
                }}
              />
              {isActive && (
                <span
                  className={cn(
                    "absolute -top-0.5 -right-0.5 rounded-full transition-all",
                    isSubOpenForThis ? "w-2 h-2 ring-2 ring-background animate-pulse" : "w-1.5 h-1.5"
                  )}
                  style={{ background: mod.color }}
                />
              )}
            </div>
            <span
              className="text-[10px] font-semibold leading-none flex items-center gap-0.5"
              style={{ color: isActive ? mod.color : 'currentColor' }}
            >
              {mod.shortLabel}
              {isActive && (
                <span className="text-[8px] opacity-70">
                  {isSubOpenForThis ? '▴' : '▾'}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
