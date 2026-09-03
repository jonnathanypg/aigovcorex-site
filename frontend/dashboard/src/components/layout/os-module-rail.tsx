'use client';

import React, { useEffect, useState } from 'react';
import { OS_MODULES, type ModuleId } from '@/lib/os-modules';
import { authService } from '@/services/auth.service';
import { useLicense } from '@/contexts/license-context';
import { cn } from '@/lib/utils';

interface OSModuleRailProps {
  activeModule: ModuleId;
  onModuleChange: (id: ModuleId) => void;
}

export function OSModuleRail({ activeModule, onModuleChange }: OSModuleRailProps) {
  const [userRole, setUserRole] = useState<string>('');
  const { hasModule } = useLicense();

  useEffect(() => {
    const user = authService.getStoredUser();
    if (user) {
      const roleName = typeof user.role === 'string' ? user.role : (user.role as any)?.name;
      setUserRole(roleName);
    }
  }, []);

  // Filter modules based on user role AND whether the module is enabled for this license
  const visibleModules = OS_MODULES.filter(m =>
    (!userRole || m.requiredRoles.includes(userRole)) && hasModule(m.id)
  );

  return (
    <div
      className="os-module-rail flex flex-col items-center py-3 gap-1 shrink-0"
      style={{ width: '72px', minHeight: '100%' }}
    >
      {/* OS Logo */}
      <div className="mb-3 flex items-center justify-center">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/30 to-orange-600/20 border border-amber-500/25 flex items-center justify-center shadow-glow-amber-sm">
          <span className="text-amber-400 text-xs font-black">GX</span>
        </div>
      </div>

      {/* Divider */}
      <div className="w-8 h-px bg-white/10 mb-1" />

      {/* Module Buttons */}
      {visibleModules.map((mod) => {
        const Icon = mod.icon;
        const isActive = activeModule === mod.id;

        return (
          <button
            key={mod.id}
            onClick={() => onModuleChange(mod.id)}
            className={cn('os-module-btn group', isActive && 'active')}
            style={isActive ? { color: mod.color, background: `${mod.color}18` } : {}}
            title={mod.label}
          >
            <Icon
              className={cn(
                'w-5 h-5 transition-transform duration-200 group-hover:scale-110',
                isActive && 'scale-110',
              )}
            />
            <span className="text-[9px] font-semibold leading-none truncate max-w-[52px] text-center px-0.5">
              {mod.shortLabel}
            </span>
            {/* Active side indicator */}
            {isActive && (
              <span
                className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1 h-5 rounded-l-full module-active-indicator"
                style={{ background: mod.color }}
              />
            )}
          </button>
        );
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom OS badge */}
      <div className="w-8 h-px bg-white/10 mb-1" />
      <div
        className="w-9 h-9 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center"
        title="AI GovCoreX OS v2.0"
      >
        <span className="text-white/30 text-[8px] font-mono">OS</span>
      </div>
    </div>
  );
}
