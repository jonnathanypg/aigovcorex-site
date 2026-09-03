"use client";

import * as React from "react";
import { format } from 'date-fns';
import { Check, X, Clock, UserCheck, UserX, Loader2, Search, Pencil, ClipboardList, MessageSquare } from "lucide-react";

import { Input } from "@/components/ui/input";

import { useRole } from "@/hooks/use-role";
import { useAgentRefresh } from "@/hooks/use-agent-refresh";

import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { childrenService, attendanceService } from "@/services";
import type { Child, AttendanceRecord } from "@/types";

type AttendanceStatus = "Presente" | "Ausente" | "Retraso";

const mapApiStatusToUi = (status: string): AttendanceStatus => {
    if (status === 'presente') return 'Presente';
    if (status === 'ausente' || status === 'justificado') return 'Ausente';
    if (status === 'tardanza' || status === 'retraso') return 'Retraso';
    return 'Presente'; // Default fallback
};

const mapUiStatusToApi = (status: AttendanceStatus): 'presente' | 'ausente' | 'justificado' | 'tardanza' => {
    if (status === 'Presente') return 'presente';
    if (status === 'Ausente') return 'ausente';
    if (status === 'Retraso') return 'tardanza';
    return 'presente';
};

interface AttendanceClientProps {
    readOnly?: boolean;
    tenantId?: number;
}

export function AttendanceClient({ readOnly = false, tenantId }: AttendanceClientProps) {
    const { role, center } = useRole();
    const [children, setChildren] = React.useState<Child[]>([]);
    const [attendanceMap, setAttendanceMap] = React.useState<Record<number, AttendanceStatus>>({});
    const [attendanceDetails, setAttendanceDetails] = React.useState<Record<number, { arrival_time?: string; notes?: string }>>({});
    const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
    const [isLoading, setIsLoading] = React.useState(true);
    const [isUpdating, setIsUpdating] = React.useState(false);
    const [filter, setFilter] = React.useState("");

    // Temporary states for popover entries
    const [tempTime, setTempTime] = React.useState<string>("");
    const [tempNotes, setTempNotes] = React.useState<string>("");
    const [activePopover, setActivePopover] = React.useState<string | null>(null);

    // Load children list
    const fetchChildren = React.useCallback(async () => {
        try {
            const data = await childrenService.getAll({ status: 'activo', tenantId });
            setChildren(data);
        } catch (error) {
            console.error("Error loading children:", error);
        } finally {
            setIsLoading(false);
        }
    }, [tenantId]);

    React.useEffect(() => {
        fetchChildren();
    }, [fetchChildren]);

    // Load attendance for selected date
    const fetchAttendance = React.useCallback(async () => {
        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const records = await attendanceService.getByDate(dateStr, tenantId);

            const newMap: Record<number, AttendanceStatus> = {};
            const newDetails: Record<number, { arrival_time?: string; notes?: string }> = {};
            
            records.forEach(rec => {
                newMap[rec.child_id] = mapApiStatusToUi(rec.status);
                newDetails[rec.child_id] = {
                    arrival_time: rec.arrival_time ? rec.arrival_time.substring(0, 5) : undefined,
                    notes: rec.notes || undefined
                };
            });
            setAttendanceMap(newMap);
            setAttendanceDetails(newDetails);
        } catch (error) {
            console.error("Error loading attendance:", error);
        }
    }, [selectedDate, tenantId]);

    React.useEffect(() => {
        fetchAttendance();
    }, [fetchAttendance]);

    // Auto-refresh when agent modifies data
    const refreshAll = React.useCallback(() => {
        fetchChildren();
        fetchAttendance();
    }, [fetchChildren, fetchAttendance]);
    useAgentRefresh(refreshAll);

    const handleDateChange = React.useCallback((date: Date | undefined) => {
        if (date) {
            setSelectedDate(date);
        }
    }, []);

    const handleStatusChange = async (childId: number, status: AttendanceStatus, customTime?: string, customNotes?: string) => {
        // Optimistic update
        setAttendanceMap(prev => ({ ...prev, [childId]: status }));
        if (customTime || customNotes) {
            setAttendanceDetails(prev => ({ 
                ...prev, 
                [childId]: { arrival_time: customTime, notes: customNotes } 
            }));
        }

        try {
            setIsUpdating(true);
            const now = new Date();
            const currentTime = format(now, 'HH:mm');
            
            await attendanceService.mark({
                child_id: childId,
                date: format(selectedDate, 'yyyy-MM-dd'),
                status: mapUiStatusToApi(status),
                arrival_time: status !== 'Ausente' ? (customTime || currentTime) : undefined,
                notes: status === 'Ausente' ? customNotes : undefined
            });
            
            // Re-fetch to sync exact times from server if needed, or just stay optimistic
            if (!customTime && status !== 'Ausente') {
                setAttendanceDetails(prev => ({
                    ...prev,
                    [childId]: { ...prev[childId], arrival_time: currentTime }
                }));
            }
        } catch (error) {
            console.error("Error marking attendance:", error);
        } finally {
            setIsLoading(false); // Should be setIsUpdating(false) mostly, but just to be sure
            setIsUpdating(false);
            setActivePopover(null); // Auto-close popover
        }
    };

    const filteredChildren = React.useMemo(() => {
        if (!filter.trim()) return children;
        const q = filter.toLowerCase();
        return children.filter(child =>
            child.full_name?.toLowerCase().includes(q) ||
            child.cedula?.toLowerCase().includes(q)
        );
    }, [children, filter]);

    const attendanceSummary = React.useMemo(() => {
        const summary: Record<AttendanceStatus | "No Registrado", number> = { Presente: 0, Ausente: 0, Retraso: 0, "No Registrado": 0 };
        filteredChildren.forEach(child => {
            const status = attendanceMap[child.id];
            if (status) {
                summary[status]++;
            } else {
                summary["No Registrado"]++;
            }
        });
        return summary;
    }, [filteredChildren, attendanceMap]);

    if (isLoading) {
        return (
            <div className="flex justify-center p-10">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
            <div className="lg:col-span-1 flex flex-col gap-6">
                <Card key="date-selector">
                    <CardHeader><CardTitle>Seleccionar Fecha</CardTitle></CardHeader>
                    <CardContent className="flex flex-col items-center">
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={handleDateChange}
                            className="rounded-md border"
                            disabled={(date) => date > new Date() || date < new Date("2020-01-01")}
                            initialFocus
                        />
                    </CardContent>
                </Card>
                {/* Filter removed temporarily as we rely on API context filtering */}
                <Card key="summary">
                    <CardHeader><CardTitle>Resumen del Día</CardTitle></CardHeader>
                    <CardContent className="pt-4 space-y-2">
                        <div className="flex justify-between items-center text-sm">
                            <span className="flex items-center gap-2 text-green-500"><UserCheck className="h-4 w-4" /> Presentes:</span>
                            <span className="font-bold">{attendanceSummary.Presente}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="flex items-center gap-2 text-yellow-500"><Clock className="h-4 w-4" /> Retrasos:</span>
                            <span className="font-bold">{attendanceSummary.Retraso}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="flex items-center gap-2 text-red-500"><UserX className="h-4 w-4" /> Ausentes:</span>
                            <span className="font-bold">{attendanceSummary.Ausente}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="flex items-center gap-2 text-muted-foreground"><UserX className="h-4 w-4" /> Sin Registrar:</span>
                            <span className="font-bold">{attendanceSummary["No Registrado"]}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-2">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Registro de Asistencia - {format(selectedDate, "PPP")}</CardTitle>
                        {isUpdating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </CardHeader>
                    <CardContent>
                        <div className="mb-4">
                            <Input
                                placeholder="Buscar por nombre o cédula..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="max-w-sm bg-background/50"
                            />
                        </div>
                        <ScrollArea className="h-[600px]">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background/80 backdrop-blur-sm z-10">
                                    <TableRow>
                                        <TableHead>Niño/a</TableHead>
                                        <TableHead>Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredChildren.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={2} className="text-center py-4">No hay niños activos para mostrar</TableCell>
                                        </TableRow>
                                    ) : filteredChildren.map((child) => {
                                        const status = attendanceMap[child.id];
                                        const details = attendanceDetails[child.id];
                                        return (
                                            <TableRow key={child.id} className="hover:bg-white/5">
                                                <TableCell>
                                                    <div className="font-medium">{child.full_name}</div>
                                                    <div className="text-sm text-muted-foreground">{child.age_display}</div>
                                                </TableCell>
                                                <TableCell>
                                                    {readOnly ? (
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center">
                                                                {status === 'Presente' && (
                                                                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">Presente</span>
                                                                )}
                                                                {status === 'Ausente' && (
                                                                    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">Ausente</span>
                                                                )}
                                                                {status === 'Retraso' && (
                                                                    <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">Retraso</span>
                                                                )}
                                                                {!status && (
                                                                    <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">No Registrado</span>
                                                                )}
                                                            </div>
                                                            {details?.arrival_time && (status === 'Presente' || status === 'Retraso') && (
                                                                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                    <Clock className="h-3 w-3" /> {details.arrival_time}
                                                                </div>
                                                            )}
                                                            {details?.notes && status === 'Ausente' && (
                                                                <div className="text-[10px] text-muted-foreground italic">
                                                                    Razon: {details.notes}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <RadioGroup
                                                            value={status || ""}
                                                            onValueChange={(value) => {
                                                                if (value === 'Presente' || value === 'Retraso') {
                                                                    // We don't call immediately, we might want a popover? 
                                                                    // Actually let's just mark it and show a popover icon to edit time if they want.
                                                                    handleStatusChange(child.id, value as AttendanceStatus);
                                                                } else if (value === 'Ausente') {
                                                                     handleStatusChange(child.id, value as AttendanceStatus);
                                                                }
                                                            }}
                                                            className="flex space-x-4"
                                                        >
                                                            <div className="flex items-center space-x-2">
                                                                <div className="flex items-center gap-2">
                                                                    <RadioGroupItem value="Presente" id={`p-${child.id}`} />
                                                                    <Label htmlFor={`p-${child.id}`} className="flex items-center gap-1 cursor-pointer">
                                                                        <Check className="h-4 w-4" /> Presente
                                                                    </Label>
                                                                    {status === 'Presente' && (
                                                                        <Popover 
                                                                            open={activePopover === `p-${child.id}`} 
                                                                            onOpenChange={(open) => setActivePopover(open ? `p-${child.id}` : null)}
                                                                        >
                                                                            <PopoverTrigger asChild>
                                                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                                                    <Clock className="h-3.5 h-3.5 text-muted-foreground" />
                                                                                </Button>
                                                                            </PopoverTrigger>
                                                                            <PopoverContent className="w-48 p-3 shadow-xl">
                                                                                <div className="space-y-3">
                                                                                    <Label className="text-xs">Hora de Entrada</Label>
                                                                                    <Input 
                                                                                        type="time" 
                                                                                        size={1} 
                                                                                        className="h-8 text-xs" 
                                                                                        defaultValue={details?.arrival_time || format(new Date(), 'HH:mm')}
                                                                                        onChange={(e) => setTempTime(e.target.value)}
                                                                                    />
                                                                                    <Button 
                                                                                        size="sm" 
                                                                                        className="w-full h-7 text-[10px]" 
                                                                                        onClick={() => handleStatusChange(child.id, 'Presente', tempTime)}
                                                                                    >
                                                                                        Actualizar Hora
                                                                                    </Button>
                                                                                </div>
                                                                            </PopoverContent>
                                                                        </Popover>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center space-x-2">
                                                                <div className="flex items-center gap-2">
                                                                    <RadioGroupItem value="Ausente" id={`a-${child.id}`} />
                                                                    <Label htmlFor={`a-${child.id}`} className="flex items-center gap-1 cursor-pointer">
                                                                        <X className="h-4 w-4" /> Ausente
                                                                    </Label>
                                                                    {status === 'Ausente' && (
                                                                        <Popover
                                                                            open={activePopover === `a-${child.id}`} 
                                                                            onOpenChange={(open) => setActivePopover(open ? `a-${child.id}` : null)}
                                                                        >
                                                                            <PopoverTrigger asChild>
                                                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                                                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                                                                                </Button>
                                                                            </PopoverTrigger>
                                                                            <PopoverContent className="w-56 p-3 shadow-xl">
                                                                                <div className="space-y-3">
                                                                                    <Label className="text-xs font-bold">Motivo de Ausencia</Label>
                                                                                    <Select 
                                                                                        defaultValue={details?.notes || "Injustificado"}
                                                                                        onValueChange={(val) => setTempNotes(val)}
                                                                                    >
                                                                                        <SelectTrigger className="h-8 text-xs">
                                                                                            <SelectValue placeholder="Seleccionar motivo" />
                                                                                        </SelectTrigger>
                                                                                        <SelectContent>
                                                                                            <SelectItem value="Enfermedad">Enfermedad</SelectItem>
                                                                                            <SelectItem value="Cita Médica">Cita Médica</SelectItem>
                                                                                            <SelectItem value="Problema Familiar">Problema Familiar</SelectItem>
                                                                                            <SelectItem value="Vacaciones">Vacaciones</SelectItem>
                                                                                            <SelectItem value="Injustificado">Sin Justificación</SelectItem>
                                                                                        </SelectContent>
                                                                                    </Select>
                                                                                    <Button 
                                                                                        size="sm" 
                                                                                        className="w-full h-7 text-[10px]"
                                                                                        onClick={() => handleStatusChange(child.id, 'Ausente', undefined, tempNotes)}
                                                                                    >
                                                                                        Guardar Motivo
                                                                                    </Button>
                                                                                </div>
                                                                            </PopoverContent>
                                                                        </Popover>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center space-x-2">
                                                                <div className="flex items-center gap-2">
                                                                    <RadioGroupItem value="Retraso" id={`r-${child.id}`} />
                                                                    <Label htmlFor={`r-${child.id}`} className="flex items-center gap-1 cursor-pointer">
                                                                        <Clock className="h-4 w-4" /> Retraso
                                                                    </Label>
                                                                    {status === 'Retraso' && (
                                                                        <Popover
                                                                            open={activePopover === `r-${child.id}`} 
                                                                            onOpenChange={(open) => setActivePopover(open ? `r-${child.id}` : null)}
                                                                        >
                                                                            <PopoverTrigger asChild>
                                                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                                                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                                                                </Button>
                                                                            </PopoverTrigger>
                                                                            <PopoverContent className="w-48 p-3 shadow-xl">
                                                                                <div className="space-y-3">
                                                                                    <Label className="text-xs">Hora de Retraso</Label>
                                                                                    <Input 
                                                                                        type="time" 
                                                                                        className="h-8 text-xs" 
                                                                                        defaultValue={details?.arrival_time || format(new Date(), 'HH:mm')}
                                                                                        onChange={(e) => setTempTime(e.target.value)}
                                                                                    />
                                                                                    <Button 
                                                                                        size="sm" 
                                                                                        className="w-full h-7 text-[10px]"
                                                                                        onClick={() => handleStatusChange(child.id, 'Retraso', tempTime)}
                                                                                    >
                                                                                        Actualizar Hora
                                                                                    </Button>
                                                                                </div>
                                                                            </PopoverContent>
                                                                        </Popover>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </RadioGroup>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
