"use client";

import React, { useState, useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './app-sidebar';
import { AppHeader } from './app-header';
import { ChatWidget } from '@/components/chat';

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <AppSidebar />
      </Sidebar>
      <SidebarInset>
        <AppHeader />
        <main className="p-4 lg:p-6">{children}</main>
      </SidebarInset>

      {/* Global AI Chat Widget */}
      <ChatWidget />
    </SidebarProvider>
  );
}
