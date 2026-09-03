'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { OS_MODULES, type ModuleId } from '@/lib/os-modules';
import { X } from 'lucide-react';

interface OSSubNavPanelProps {
  activeModule: ModuleId;
  isOpen: boolean;
  onClose?: () => void;
  onNavigate?: () => void;
}

export function OSSubNavPanel({ activeModule, isOpen, onClose, onNavigate }: OSSubNavPanelProps) {
  const pathname = usePathname();
  const mod = OS_MODULES.find(m => m.id === activeModule);

  if (!mod) return null;

  return (
    <div
      className={cn(
        'os-subnav-panel flex-col shrink-0 overflow-hidden',
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        'hidden md:flex',
      )}
      style={{ width: isOpen ? '240px' : '0px' }}
    >
      {/* Module Header */}
      <div
        className="px-4 py-4 border-b border-white/8 flex items-center justify-between shrink-0"
        style={{ borderBottomColor: `${mod.color}25` }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${mod.color}20`, border: `1px solid ${mod.color}35` }}
          >
            <mod.icon className="w-4 h-4" style={{ color: mod.color }} />
          </div>
          <div>
            <p className="text-white text-xs font-bold leading-none">{mod.label}</p>
            {mod.badgeLabel && (
              <span className={cn('text-[9px] font-bold tracking-widest uppercase', mod.textClass)}>
                {mod.badgeLabel}
              </span>
            )}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden text-white/40 hover:text-white/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav Sections */}
      <div className="flex-1 overflow-y-auto py-2 scrollbar-none">
        {mod.sections.map((section) => (
          <div key={section.title} className="mb-2">
            <p className="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/25">
              {section.title}
            </p>
            {section.items.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-sm transition-all duration-150 group',
                    isActive
                      ? 'text-white font-medium'
                      : 'text-white/50 hover:text-white/85 hover:bg-white/5',
                  )}
                  style={
                    isActive
                      ? {
                          background: `${mod.color}18`,
                          border: `1px solid ${mod.color}30`,
                          color: 'white',
                        }
                      : {}
                  }
                >
                  <Icon
                    className={cn(
                      'w-4 h-4 shrink-0 transition-colors',
                      !isActive && 'group-hover:text-white/70',
                    )}
                    style={isActive ? { color: mod.color } : {}}
                  />
                  <span className="truncate text-[13px]">{item.label}</span>
                  {isActive && (
                    <span
                      className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: mod.color }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
