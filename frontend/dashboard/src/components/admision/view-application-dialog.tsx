"use client";

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Home, Briefcase, GraduationCap, HeartPulse, FileText } from "lucide-react";
import { applicationsService } from "@/services/applications.service";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ViewApplicationDialogProps {
    applicationId: number | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ViewApplicationDialog({ applicationId, open, onOpenChange }: ViewApplicationDialogProps) {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (open && applicationId) {
            loadData();
        } else {
            setData(null);
        }
    }, [open, applicationId]);

    const loadData = async () => {
        try {
            setIsLoading(true);
            // @ts-ignore
            const result = await applicationsService.getById(applicationId!);
            setData(result);
        } catch (error) {
            console.error("Error loading application details:", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!open) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Ficha de Postulación
                        {data && (
                            <Badge variant={
                                data.application.status === 'approved' ? 'default' :
                                    data.application.status === 'rejected' ? 'destructive' : 'secondary'
                            }>
                                {data.application.status === 'approved' ? 'Aprobado' :
                                    data.application.status === 'rejected' ? 'Rechazado' :
                                        data.application.status === 'waitlist' ? 'Lista de Espera' : 'Pendiente'}
                            </Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : data ? (
                    <div className="space-y-6">
                        {/* ── Child Info ── */}
                        <div className="bg-muted/30 p-4 rounded-lg border">
                            <h3 className="font-semibold flex items-center gap-2 mb-3 text-primary">
                                <User className="h-4 w-4" /> Datos del Niño/a
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground block text-xs uppercase">Nombres</span>
                                    {data.application.child_first_name} {data.application.child_last_name}
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs uppercase">Cédula</span>
                                    {data.application.child_cedula || "-"}
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs uppercase">Fecha Nacimiento</span>
                                    {data.application.child_birth_date} (Edad: {data.application.child_age_months} meses)
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs uppercase">Género</span>
                                    <span className="capitalize">{data.application.child_gender}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs uppercase">Fecha Inscripción</span>
                                    {data.application.child_enrollment_date || "-"}
                                </div>
                            </div>
                        </div>

                        {/* ── Representative Info ── */}
                        <div className="bg-muted/30 p-4 rounded-lg border">
                            <h3 className="font-semibold flex items-center gap-2 mb-3 text-primary">
                                <Users className="h-4 w-4" /> Representante
                            </h3>
                            {data.representatives.map((rep: any, idx: number) => (
                                <div key={rep.id} className={idx > 0 ? "mt-4 pt-4 border-t border-dashed" : ""}>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                        <div>
                                            <span className="text-muted-foreground block text-xs uppercase">Nombre Completo</span>
                                            {rep.first_name} {rep.last_name}
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-xs uppercase">Parentesco</span>
                                            <span className="capitalize">{rep.relationship}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-xs uppercase">Cédula</span>
                                            {rep.cedula || "-"}
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-xs uppercase">Teléfono</span>
                                            {rep.phone || "-"}
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-xs uppercase">Nacionalidad</span>
                                            {rep.nationality}
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-xs uppercase">Lugar Nacimiento</span>
                                            {rep.birth_place} ({rep.birth_province})
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-xs uppercase">Ocupación</span>
                                            {rep.occupation || "-"}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ── Address Info ── */}
                        <div className="bg-muted/30 p-4 rounded-lg border">
                            <h3 className="font-semibold flex items-center gap-2 mb-3 text-primary">
                                <Home className="h-4 w-4" /> Domicilio y Contacto
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                <div className="col-span-2">
                                    <span className="text-muted-foreground block text-xs uppercase">Dirección</span>
                                    {data.family.address}
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs uppercase">Sector / Barrio</span>
                                    {data.family.sector} / {data.family.neighborhood || "-"}
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs uppercase">Ciudad/Provincia</span>
                                    {data.family.city}, {data.family.province}
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs uppercase">Teléfonos</span>
                                    {data.family.phone_primary} / {data.family.phone_secondary || "-"}
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs uppercase">Tiempo Residencia</span>
                                    {data.family.residency_years} años
                                </div>
                                {data.family.previous_address && (
                                    <div className="col-span-2">
                                        <span className="text-muted-foreground block text-xs uppercase">Dirección Anterior</span>
                                        {data.family.previous_address} ({data.family.previous_city}, {data.family.previous_province})
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Socioeconomic Info ── */}
                        <div className="bg-muted/30 p-4 rounded-lg border">
                            <h3 className="font-semibold flex items-center gap-2 mb-3 text-primary">
                                <Briefcase className="h-4 w-4" /> Perfil Socioeconómico
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground block text-xs uppercase">Vivienda</span>
                                    <span className="capitalize">{data.family.housing_type?.replace(/_/g, ' ')}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs uppercase">Empleo Jefe Hogar</span>
                                    <span className="capitalize">{data.family.employment_type?.replace(/_/g, ' ')}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs uppercase">Ingreso Mensual</span>
                                    <span className="capitalize">{data.family.monthly_income_range?.replace(/_/g, ' ')}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs uppercase">Tipo Hogar</span>
                                    <span className="capitalize">{data.family.household_type?.replace(/_/g, ' ')}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs uppercase">Condición Económica</span>
                                    <span className="capitalize">{data.family.economic_condition?.replace(/_/g, ' ')}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs uppercase">Etnia</span>
                                    <span className="capitalize">{data.family.ethnic_identity}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs uppercase">Movilidad Humana</span>
                                    <span className="capitalize">{data.family.mobility_status?.replace(/_/g, ' ')}</span>
                                    {data.family.migrant_origin && <span className="text-xs text-muted-foreground block">({data.family.migrant_origin})</span>}
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs uppercase">Discapacidad</span>
                                    {data.family.has_disability ? "Sí" : "No"}
                                    {data.family.has_disability && <span className="text-xs text-muted-foreground block">{data.family.disability_detail}</span>}
                                </div>
                            </div>

                            {data.family.social_risks && data.family.social_risks.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-dashed">
                                    <span className="text-muted-foreground block text-xs uppercase mb-2">Riesgos Sociales Identificados</span>
                                    <div className="flex flex-wrap gap-2">
                                        {data.family.social_risks.map((risk: string) => (
                                            <Badge key={risk} variant="outline" className="capitalize">
                                                {risk.replace(/_/g, ' ')}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-10 text-muted-foreground">
                        No se encontró información para esta solicitud.
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function Users(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    )
}
