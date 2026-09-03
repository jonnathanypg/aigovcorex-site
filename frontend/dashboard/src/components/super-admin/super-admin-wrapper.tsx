"use client";

import { RoleGuard } from '@/components/auth/role-guard';
import { SuperAdminClient } from '@/components/super-admin/super-admin-client';

/**
 * Wrapper component that protects the Super Admin panel.
 * Only users with 'super_admin' role can access this.
 */
export function SuperAdminWrapper() {
    return (
        <RoleGuard allowedRoles={['super_admin']} redirectTo="/login">
            <div className="container mx-auto py-6">
                <SuperAdminClient />
            </div>
        </RoleGuard>
    );
}
