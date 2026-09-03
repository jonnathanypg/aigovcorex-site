"use client";

import { Button } from "@/components/ui/button";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentAdmissions } from "@/components/dashboard/recent-admissions";
import { DevelopmentChart } from "@/components/dashboard/development-chart";
import { CentersSummary } from "@/components/dashboard/centers-summary";
import { useRole } from "@/hooks/use-role";
import { useLicense } from "@/contexts/license-context";
import { SponsorLogoDisplay } from "@/components/license-admin/SponsorLogoDisplay";

export default function DashboardPage() {
    const { role, center } = useRole();
    const { isLicenseAdmin, selectedCenterId } = useLicense();

    // Determine filter
    const tenantId = (isLicenseAdmin && selectedCenterId !== 'all') ? Number(selectedCenterId) : undefined;
    const showGlobalSummary = isLicenseAdmin && selectedCenterId === 'all';

    const getTitle = () => {
        if (role === 'admin' || showGlobalSummary) {
            return "Torre de Control General";
        }
        if (isLicenseAdmin && tenantId) {
            return "Torre de Control de Centro";
        }
        return `Torre de Control: ${center || 'Mi Centro'}`;
    }

    const getDescription = () => {
        if (role === 'admin' || showGlobalSummary) {
            return "Vista general consolidada del estado de todos los centros.";
        }
        if (isLicenseAdmin && tenantId) {
            return "Vista detallada de los indicadores del centro seleccionado.";
        }
        return `Vista general del estado del ${center || 'centro'} en tiempo real.`;
    }

    return (
        <div className="flex flex-col gap-8">
            {/* Logos de patrocinadores (visible para todos los roles) */}
            <SponsorLogoDisplay usePublicEndpoint={true} />

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

            <StatsCards tenantId={tenantId} />

            {showGlobalSummary && <CentersSummary />}

            <div className="grid gap-8 grid-cols-1 lg:grid-cols-7">
                <RecentAdmissions tenantId={tenantId} />
                <DevelopmentChart tenantId={tenantId} />
            </div>
        </div>
    );
}
