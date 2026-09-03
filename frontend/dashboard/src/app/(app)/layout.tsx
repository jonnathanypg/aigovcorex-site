"use client";

import { useEffect, useState } from 'react';
import { OSShellLayout } from '@/components/layout/os-shell-layout';
import { AuthGuard } from '@/components/auth/auth-guard';
import { RoleGuard } from '@/components/auth/role-guard';
import { WaitingForAssignment } from '@/components/auth/waiting-for-assignment';
import { authService } from '@/services/auth.service';
import { Loader2 } from 'lucide-react';

/**
 * Main App Layout.
 * - Blocks super_admin (they should use /super-admin).
 * - Shows WaitingForAssignment for users without tenant_id (except license_admin).
 * - Allows license_admin, coordinator, educator, etc.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isUnassigned, setIsUnassigned] = useState<boolean | null>(null);

  useEffect(() => {
    const user = authService.getStoredUser();
    if (user) {
      // license_admin and universal roles manage multiple centers or are global, don't need tenant_id
      const universalRoles = ['license_admin', 'supervisor', 'doctor', 'nutritionist', 'social_worker', 'psychologist', 'administrative'];
      const needsCenter = !universalRoles.includes(user.role) && user.tenant_id === null;
      setIsUnassigned(needsCenter);
    } else {
      setIsUnassigned(false);
    }
  }, []);

  // Still checking
  if (isUnassigned === null) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // User has no center assigned
  if (isUnassigned) {
    return (
      <AuthGuard>
        <WaitingForAssignment />
      </AuthGuard>
    );
  }

  // Normal flow
  return (
    <AuthGuard>
      <RoleGuard
        allowedRoles={['license_admin', 'supervisor', 'coordinator', 'educator', 'specialist', 'nutritionist', 'psychologist', 'admin', 'doctor', 'social_worker', 'administrative']}
        redirectTo="/super-admin"
      >
        <OSShellLayout>{children}</OSShellLayout>
      </RoleGuard>
    </AuthGuard>
  );
}

