"use client";

import React, { useState, useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './app-sidebar';
import { AppHeader } from './app-header';
import { ChatWidget } from '@/components/chat';
import { OnboardingWelcomeModal } from '@/components/shared/onboarding-welcome-modal';
import { OnboardingTour } from '@/components/shared/onboarding-tour';
import { OnboardingChecklistWidget } from '@/components/shared/onboarding-checklist-widget';

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  // Track if the AI chat sidebar is open so we can hide/reposition the onboarding badge
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ isOpen: boolean }>).detail;
      setIsChatOpen(detail.isOpen);
    };
    window.addEventListener('kindicore-chat-sidebar-toggle', handler);
    return () => window.removeEventListener('kindicore-chat-sidebar-toggle', handler);
  }, []);

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <AppSidebar />
      </Sidebar>
      <SidebarInset>
        <AppHeader />
        <main className="p-4 lg:p-6">{children}</main>
      </SidebarInset>

      {/* Global AI Chat Widget — full-height right sidebar */}
      <ChatWidget />

      {/* ── Onboarding System ── */}
      {/* Welcome modal (shown once on first login) */}
      <OnboardingWelcomeModal />
      {/* Guided tour overlay */}
      <OnboardingTour />
      {/* Floating setup checklist — hides when chat is open, floats above chat button */}
      <OnboardingChecklistWidget isChatOpen={isChatOpen} />
    </SidebarProvider>
  );
}
