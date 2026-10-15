"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { licenseAdminService, type Center } from "@/services/license-admin.service";
import { authService } from "@/services/auth.service";
import { usePathname } from "next/navigation";
import api from "@/services/api";

const ALL_MODULES = ['kindicore', 'social', 'geo', 'channels', 'copilot'];

interface LicenseContextType {
    isLicenseAdmin: boolean;
    isSuperAdmin: boolean;
    centers: Center[];
    selectedCenterId: number | 'all';
    setSelectedCenterId: (id: number | 'all') => void;
    isLoading: boolean;
    refreshCenters: () => Promise<void>;
    enabledModules: string[];
    hasModule: (moduleId: string) => boolean;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

export function LicenseProvider({ children }: { children: React.ReactNode }) {
    const [isLicenseAdmin, setIsLicenseAdmin] = useState(false);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [centers, setCenters] = useState<Center[]>([]);
    const [selectedCenterId, setSelectedCenterId] = useState<number | 'all'>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [enabledModules, setEnabledModules] = useState<string[]>(['kindicore']);
    const pathname = usePathname();

    const loadEnabledModules = useCallback(async (user: any) => {
        try {
            const roleName = typeof user?.role === 'string' ? user.role : (user?.role as any)?.name;

            // Super admin always has access to all modules
            if (roleName === 'super_admin') {
                setEnabledModules(ALL_MODULES);
                setIsSuperAdmin(true);
                return;
            }

            // 1. Fetch from authoritative API directly (validates active license modules)
            try {
                const { data } = await api.get('/api/auth/license-modules');
                if (data?.enabled_modules && Array.isArray(data.enabled_modules)) {
                    setEnabledModules(data.enabled_modules);
                    // Sync updated modules to localStorage so stale caches are overwritten
                    if (typeof window !== 'undefined') {
                        const stored = localStorage.getItem('user');
                        if (stored) {
                            try {
                                const parsed = JSON.parse(stored);
                                parsed.enabled_modules = data.enabled_modules;
                                localStorage.setItem('user', JSON.stringify(parsed));
                            } catch { }
                        }
                    }
                    return;
                }
            } catch (err) {
                console.warn("[license-context] Could not fetch license-modules from API, using fallback:", err);
            }

            // 2. Offline / network error fallback: use stored user modules if present
            if (user?.enabled_modules && Array.isArray(user.enabled_modules) && user.enabled_modules.length > 0) {
                setEnabledModules(user.enabled_modules);
                return;
            }

            // Default safe fallback: core module only
            setEnabledModules(['kindicore']);
        } catch (error) {
            console.error("Error loading enabled modules:", error);
            setEnabledModules(['kindicore']);
        }
    }, []);

    const checkRoleAndLoad = useCallback(async () => {
        try {
            const user = authService.getStoredUser();
            if (!user) {
                setIsLoading(false);
                return;
            }

            const roleName = typeof user?.role === 'string' ? user.role : (user?.role as any)?.name;
            const isAdmin = roleName === 'license_admin' || roleName === 'supervisor' || roleName === 'doctor';
            const isSA = roleName === 'super_admin';

            setIsLicenseAdmin(isAdmin);
            setIsSuperAdmin(isSA);

            // Load enabled modules
            await loadEnabledModules(user);

            if (isAdmin || isSA) {
                await loadCenters();
            } else {
                setCenters([]);
            }
        } catch (error) {
            console.error("Error initializing license context:", error);
        } finally {
            setIsLoading(false);
        }
    }, [loadEnabledModules]);

    const loadCenters = async () => {
        try {
            const data = await licenseAdminService.getCenters();
            setCenters(data.filter(c => c.is_active));
        } catch (error) {
            console.error("Error loading centers for context:", error);
        }
    };

    useEffect(() => {
        checkRoleAndLoad();
    }, [pathname, checkRoleAndLoad]);

    // Listen for custom login event
    useEffect(() => {
        const handleLogin = () => {
            checkRoleAndLoad();
        };
        window.addEventListener('user-login', handleLogin);
        return () => window.removeEventListener('user-login', handleLogin);
    }, [checkRoleAndLoad]);

    const hasModule = useCallback((moduleId: string) => {
        if (isSuperAdmin) return true;
        return enabledModules.includes(moduleId);
    }, [enabledModules, isSuperAdmin]);

    const value: LicenseContextType = {
        isLicenseAdmin,
        isSuperAdmin,
        centers,
        selectedCenterId,
        setSelectedCenterId,
        isLoading,
        refreshCenters: loadCenters,
        enabledModules,
        hasModule,
    };

    return (
        <LicenseContext.Provider value={value}>
            {children}
        </LicenseContext.Provider>
    );
}

export function useLicense() {
    const context = useContext(LicenseContext);
    if (context === undefined) {
        return {
            isLicenseAdmin: false,
            isSuperAdmin: false,
            centers: [],
            selectedCenterId: 'all',
            setSelectedCenterId: () => { },
            isLoading: false,
            refreshCenters: async () => { },
            enabledModules: ['kindicore'],
            hasModule: (moduleId: string) => moduleId === 'kindicore',
        } as LicenseContextType;
    }
    return context;
}
