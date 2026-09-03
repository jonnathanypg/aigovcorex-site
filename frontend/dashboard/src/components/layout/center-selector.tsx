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

export function CenterSelector() {
    const { isLicenseAdmin, isLoading, centers, selectedCenterId, setSelectedCenterId } = useLicense();

    // Wait for context to load before deciding visibility
    if (isLoading) {
        return null; // or a skeleton placeholder
    }

    if (!isLicenseAdmin) return null;

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
