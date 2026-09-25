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
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-fade-in"
        />
      )}

      <div
        className={cn(
          'os-subnav-panel flex flex-col shrink-0 overflow-hidden transition-all duration-300 ease-in-out',
          // Desktop behavior: slide panel inside layout flow
          'hidden md:flex',
          isOpen ? 'md:w-[240px] md:opacity-100' : 'md:w-0 md:opacity-0 pointer-events-none',
        )}
      >
        {/* Module Header */}
        <div
          className="px-4 py-4 border-b border-border/60 flex items-center justify-between shrink-0"
          style={{ borderBottomColor: `${mod.color}35` }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${mod.color}20`, border: `1px solid ${mod.color}35` }}
            >
              <mod.icon className="w-4 h-4" style={{ color: mod.color }} />
            </div>
            <div>
              <p className="text-foreground text-xs font-bold leading-none">{mod.label}</p>
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
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Cerrar menú"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Nav Sections */}
        <div className="flex-1 overflow-y-auto py-2 scrollbar-none">
          {mod.sections.map((section) => (
            <div key={section.title} className="mb-2">
              <p className="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
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
                        ? 'font-medium shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                    )}
                    style={
                      isActive
                        ? {
                            background: `${mod.color}18`,
                            border: `1px solid ${mod.color}40`,
                            color: mod.color,
                          }
                        : {}
                    }
                  >
                    <Icon
                      className={cn(
                        'w-4 h-4 shrink-0 transition-colors',
                        !isActive && 'group-hover:text-foreground',
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

      {/* Mobile Drawer (Bottom Sheet or Slide-up above Bottom Nav) */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-14 z-40 max-h-[75vh] flex flex-col rounded-t-2xl shadow-2xl border-t border-border/80 md:hidden transition-transform duration-300 ease-in-out',
          'bg-background/95 backdrop-blur-2xl text-foreground',
          isOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'
        )}
      >
        {/* Mobile Pull Handle Pill */}
        <div className="w-full flex items-center justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Mobile Header */}
        <div
          className="px-4 py-2.5 border-b border-border/50 flex items-center justify-between shrink-0"
          style={{ borderBottomColor: `${mod.color}35` }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${mod.color}20`, border: `1px solid ${mod.color}35` }}
            >
              <mod.icon className="w-4 h-4" style={{ color: mod.color }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-foreground text-sm font-bold leading-none">{mod.label}</p>
                {mod.badgeLabel && (
                  <span className={cn('text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded', mod.bgClass, mod.textClass)}>
                    {mod.badgeLabel}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Opciones y submenús</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Mobile Nav Items */}
        <div className="flex-1 overflow-y-auto py-2 px-1 max-h-[55vh] pb-4">
          {mod.sections.map((section) => (
            <div key={section.title} className="mb-3">
              <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {section.title}
              </p>
              <div className="grid grid-cols-1 gap-1">
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
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 active:scale-[0.98]',
                        isActive
                          ? 'font-semibold shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                      )}
                      style={
                        isActive
                          ? {
                              background: `${mod.color}18`,
                              border: `1px solid ${mod.color}40`,
                              color: mod.color,
                            }
                          : {}
                      }
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={isActive ? { background: `${mod.color}25` } : { background: 'var(--muted)' }}
                      >
                        <Icon
                          className="w-4 h-4"
                          style={isActive ? { color: mod.color } : {}}
                        />
                      </div>
                      <span className="truncate text-sm">{item.label}</span>
                      {isActive && (
                        <span
                          className="ml-auto w-2 h-2 rounded-full shrink-0"
                          style={{ background: mod.color }}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
