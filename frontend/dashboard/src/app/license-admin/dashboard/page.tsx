"use client";

import { Button } from "@/components/ui/button";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentAdmissions } from "@/components/dashboard/recent-admissions";
import { DevelopmentChart } from "@/components/dashboard/development-chart";
import { CentersSummary } from "@/components/dashboard/centers-summary";
import { useLicense } from "@/contexts/license-context";
import { SponsorLogoDisplay } from "@/components/license-admin/SponsorLogoDisplay";

export default function LicenseAdminDashboardPage() {
    const { selectedCenterId, centers } = useLicense();

    // Determine filter (Standardized Logic)
    const tenantId = selectedCenterId !== 'all' ? Number(selectedCenterId) : undefined;
    const showGlobalSummary = selectedCenterId === 'all';

    // Helper to get center name
    const selectedCenterName = centers.find(c => c.id === tenantId)?.name || 'Centro';

    const getTitle = () => {
        if (showGlobalSummary) {
            return "Torre de Control General";
        }
        return `Torre de Control: ${selectedCenterName}`;
    }

    const getDescription = () => {
        if (showGlobalSummary) {
            return "Vista general consolidada del estado de todos los centros asociados a la licencia.";
        }
        return `Vista detallada de los indicadores del ${selectedCenterName}.`;
    }

    return (
        <div className="flex flex-col gap-8">
            {/* Logos de Patrocinadores (Branding Superior) */}
            {/* Logos de Patrocinadores (Branding Superior) */}
            <SponsorLogoDisplay />

            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline">
                        {getTitle()}
                    </h1>
                    <p className="text-muted-foreground">
                        {getDescription()}
                    </p>
                </div>
            </div>



            {/* Reactive Components - they listen to tenantId change automatically if passed prop changes */}
            <StatsCards tenantId={tenantId} />

            {showGlobalSummary && <CentersSummary />}

            <div className="grid gap-8 grid-cols-1 lg:grid-cols-7">
                <RecentAdmissions tenantId={tenantId} />
                <DevelopmentChart tenantId={tenantId} />
            </div>
        </div>
    );
}
