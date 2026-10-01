"use client";

import { useState } from "react";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentAdmissions } from "@/components/dashboard/recent-admissions";
import { DevelopmentChart } from "@/components/dashboard/development-chart";
import { CentersSummary } from "@/components/dashboard/centers-summary";
import { DateRangeFilter, type DateRange } from "@/components/dashboard/date-range-filter";
import { useRole } from "@/hooks/use-role";
import { useLicense } from "@/contexts/license-context";
import { SponsorLogoDisplay } from "@/components/license-admin/SponsorLogoDisplay";

export default function DashboardPage() {
    const { role, center } = useRole();
    const { isLicenseAdmin, selectedCenterId } = useLicense();
    const [range, setRange] = useState<DateRange>({ preset: "month" });

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
            return "Vista general consolidada del estado de todos los centros. Filtre por fechas específicas o periodos personalizados.";
        }
        if (isLicenseAdmin && tenantId) {
            return "Vista detallada de los indicadores del centro seleccionado. Filtre por fechas específicas o periodos personalizados.";
        }
        return `Vista general del estado del ${center || 'centro'} en tiempo real. Filtre por fechas específicas o periodos personalizados.`;
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

            <DateRangeFilter value={range} onChange={setRange} />

            <StatsCards tenantId={tenantId} from={range.from} to={range.to} />

            {showGlobalSummary && <CentersSummary />}

            <div className="grid gap-8 grid-cols-1 lg:grid-cols-7">
                <RecentAdmissions tenantId={tenantId} from={range.from} to={range.to} />
                <DevelopmentChart tenantId={tenantId} from={range.from} to={range.to} />
            </div>
        </div>
    );
}
