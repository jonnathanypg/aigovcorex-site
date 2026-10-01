"use client";

import { useLicense } from "@/contexts/license-context";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Building2, Globe, Loader2 } from "lucide-react";

import { useRole } from "@/hooks/use-role";

export function CenterSelector() {
    const { isLicenseAdmin, isLoading, centers, selectedCenterId, setSelectedCenterId } = useLicense();
    const { center } = useRole();

    // Wait for context to load before deciding visibility
    if (isLoading) {
        return null; // or a skeleton placeholder
    }

    if (!isLicenseAdmin) {
        if (!center) return null;
        return (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 border border-primary/20 text-primary mr-2">
                <Building2 className="h-3.5 w-3.5" />
                <span className="truncate max-w-[160px]">{center}</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 mr-4">
            <Select
                value={selectedCenterId.toString()}
                onValueChange={(val) => setSelectedCenterId(val === 'all' ? 'all' : Number(val))}
            >
                <SelectTrigger className="w-[200px] h-9 bg-background/50 backdrop-blur border-primary/20">
                    <div className="flex items-center gap-2 truncate">
                        {selectedCenterId !== 'all' && (
                            <Building2 className="h-4 w-4 text-primary" />
                        )}
                        <SelectValue placeholder="Seleccionar Centro" />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">
                        <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Vista Global</span>
                        </div>
                    </SelectItem>
                    {centers.map((center) => (
                        <SelectItem key={center.id} value={center.id.toString()}>
                            {center.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
