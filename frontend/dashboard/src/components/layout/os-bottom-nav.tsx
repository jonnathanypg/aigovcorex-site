'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { OS_MODULES, type ModuleId } from '@/lib/os-modules';
import { authService } from '@/services/auth.service';
import { useLicense } from '@/contexts/license-context';

interface OSBottomNavProps {
  activeModule: ModuleId;
  onModuleChange: (id: ModuleId) => void;
}

export function OSBottomNav({ activeModule, onModuleChange }: OSBottomNavProps) {
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

        return (
          <button
            key={mod.id}
            onClick={() => onModuleChange(mod.id)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 flex-1 max-w-[80px]',
              isActive ? 'opacity-100' : 'opacity-50',
            )}
            style={isActive ? { background: `${mod.color}18` } : {}}
          >
            <div className="relative">
              <Icon
                className="w-5 h-5"
                style={{ color: isActive ? mod.color : 'rgba(255,255,255,0.5)' }}
              />
              {isActive && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
                  style={{ background: mod.color }}
                />
              )}
            </div>
            <span
              className="text-[10px] font-semibold leading-none"
              style={{ color: isActive ? mod.color : 'rgba(255,255,255,0.45)' }}
            >
              {mod.shortLabel}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
