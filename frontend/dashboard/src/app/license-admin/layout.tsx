"use client";

import { RoleGuard } from '@/components/auth/role-guard';
import { OSShellLayout } from '@/components/layout/os-shell-layout';

/**
 * Layout for /license-admin/* routes.
 * Uses the full AI GovCoreX OS Shell with all modules.
 */
export default function LicenseAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <RoleGuard allowedRoles={['license_admin', 'supervisor', 'admin']} redirectTo="/dashboard">
            <OSShellLayout>
                {children}
            </OSShellLayout>
        </RoleGuard>
    );
}

