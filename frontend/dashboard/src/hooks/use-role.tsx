
"use client";

import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';

type Role = 'license_admin' | 'admin' | 'coordinator' | 'educator' | 'worker' | 'super_admin' | 'doctor' | 'nutritionist' | 'social_worker' | 'psychologist' | 'administrative' | 'supervisor';

interface RoleContextType {
  role: Role;
  userId: number | null;
  center: string | null;
  setRole: (role: Role) => void;
  setCenter: (center: string | null) => void;
  canEdit: boolean;
  canDelete: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

function getStoredRole(): Role {
  if (typeof window === 'undefined') return 'admin';
  try {
    const stored = localStorage.getItem('user');
    if (stored) {
      const user = JSON.parse(stored);
      if (user.role) return user.role as Role;
    }
  } catch { }
  return 'admin';
}

function getStoredUserId(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('user');
    if (stored) {
      const user = JSON.parse(stored);
      if (user.id) return user.id;
    }
  } catch { }
  return null;
}

function getStoredCenter(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('user');
    if (stored) {
      const user = JSON.parse(stored);
      if (user.tenant_name) return user.tenant_name;
    }
  } catch { }
  return null;
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>(getStoredRole);
  const [userId, setUserId] = useState<number | null>(getStoredUserId);
  const [center, setCenter] = useState<string | null>(getStoredCenter);

  // Re-sync when storage changes (e.g. after login from another tab or same-page login)
  const syncFromStorage = useCallback(() => {
    const newRole = getStoredRole();
    const newUserId = getStoredUserId();
    const newCenter = getStoredCenter();
    setRole(newRole);
    setUserId(newUserId);
    setCenter(newCenter);
  }, []);

  useEffect(() => {
    // Listen for storage events (cross-tab)
    window.addEventListener('storage', syncFromStorage);
    // Listen for custom login event (same-tab)
    window.addEventListener('user-login', syncFromStorage);

    // Also sync on mount in case state is stale
    syncFromStorage();

    return () => {
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener('user-login', syncFromStorage);
    };
  }, [syncFromStorage]);

  const value = useMemo(() => {
    const canEdit = ['license_admin', 'admin', 'coordinator', 'super_admin', 'doctor', 'nutritionist', 'social_worker', 'psychologist', 'administrative', 'supervisor'].includes(role);
    const canDelete = ['license_admin', 'admin', 'super_admin', 'supervisor'].includes(role);

    return { role, userId, center, setRole, setCenter, canEdit, canDelete };
  }, [role, userId, center]);

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
