"use client";

import { useState, useMemo, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Baby, Users, MapPin, BarChart3, ChevronLeft, ChevronRight, Save, Check } from "lucide-react";
import { applicationsService } from "@/services/applications.service";
import { cn } from "@/lib/utils";
import { authService } from "@/services/auth.service";
import { licenseAdminService } from "@/services/license-admin.service";

// ─── Dropdown Options ─────────────────────────────────────────────
const NATIONALITY_OPTIONS = [
    { value: "Ecuatoriana", label: "Ecuatoriana" },
    { value: "Colombiana", label: "Colombiana" },
    { value: "Venezolana", label: "Venezolana" },
    { value: "Peruana", label: "Peruana" },
    { value: "Cubana", label: "Cubana" },
    { value: "Haitiana", label: "Haitiana" },
    { value: "Otra", label: "Otra" },
];

const HOUSING_OPTIONS = [
    { value: "propia_pagada", label: "Propia y totalmente pagada" },
    { value: "propia_pagando", label: "Propia, la están pagando" },
    { value: "arrendada", label: "Arrendada" },
    { value: "prestada", label: "Prestada o cedida" },
    { value: "por_servicios", label: "Por servicios" },
    { value: "anticresis", label: "Anticresis" },
    { value: "invasion", label: "Asentamiento / invasión" },
];

const EMPLOYMENT_OPTIONS = [
    { value: "empleo_adecuado", label: "Empleo adecuado / formal" },
    { value: "subempleo", label: "Subempleo" },
    { value: "empleo_informal", label: "Empleo informal" },
    { value: "empleo_no_remunerado", label: "Empleo no remunerado" },
    { value: "desempleo", label: "Desempleo" },
    { value: "trabajo_domestico", label: "Trabajo doméstico" },
    { value: "independiente", label: "Trabajador independiente / autónomo" },
    { value: "jubilado", label: "Jubilado/a" },
];

const INCOME_OPTIONS = [
    { value: "menos_100", label: "Menos de $100" },
    { value: "100_250", label: "$100 — $250" },
    { value: "250_482", label: "$250 — $482 (menor al SBU)" },
    { value: "482_700", label: "$482 — $700 (1 SBU)" },
    { value: "700_1000", label: "$700 — $1,000" },
    { value: "mas_1000", label: "Más de $1,000" },
];

const HOUSEHOLD_OPTIONS = [
    { value: "nuclear", label: "Nuclear (padres e hijos)" },
    { value: "monoparental", label: "Monoparental (un solo progenitor)" },
    { value: "extendido", label: "Extendido (con otros familiares)" },
    { value: "reconstituido", label: "Reconstituido / ensamblado" },
    { value: "unipersonal", label: "Unipersonal" },
    { value: "sin_nucleo", label: "Sin núcleo (otros arreglos)" },
];

const ECONOMIC_OPTIONS = [
    { value: "pobreza_extrema", label: "Pobreza extrema (< $52/mes per cápita)" },
    { value: "pobreza", label: "Pobreza (< $92/mes per cápita)" },
    { value: "vulnerable", label: "Vulnerable (no pobre pero en riesgo)" },
    { value: "estable", label: "Condición estable" },
];

const GEOGRAPHIC_OPTIONS = [
    { value: "urbano", label: "Urbano" },
    { value: "urbano_marginal", label: "Urbano marginal" },
    { value: "periurbano", label: "Periurbano" },
    { value: "rural", label: "Rural" },
];

const ETHNIC_OPTIONS = [
    { value: "mestizo", label: "Mestizo/a" },
    { value: "indigena", label: "Indígena" },
    { value: "afroecuatoriano", label: "Afroecuatoriano/a" },
    { value: "montubio", label: "Montubio/a" },
    { value: "blanco", label: "Blanco/a" },
    { value: "otro", label: "Otro" },
];

const MOBILITY_OPTIONS = [
    { value: "no_aplica", label: "No aplica" },
    { value: "inmigrante", label: "Inmigrante" },
    { value: "refugiado", label: "Refugiado/a" },
    { value: "solicitante_asilo", label: "Solicitante de asilo" },
    { value: "retornado", label: "Emigrante retornado" },
    { value: "desplazado_interno", label: "Desplazamiento interno" },
];

const SOCIAL_RISK_OPTIONS = [
    { value: "violencia_intrafamiliar", label: "Violencia intrafamiliar" },
    { value: "trabajo_infantil", label: "Trabajo infantil" },
    { value: "hacinamiento", label: "Hacinamiento" },
    { value: "consumo_sustancias", label: "Consumo de sustancias" },
    { value: "mendicidad", label: "Mendicidad" },
    { value: "trata_personas", label: "Trata de personas" },
    { value: "desnutricion", label: "Desnutrición / inseguridad alimentaria" },
    { value: "abandono", label: "Abandono o negligencia" },
    { value: "explotacion_laboral", label: "Explotación laboral" },
    { value: "discriminacion", label: "Discriminación / xenofobia" },
    { value: "ninguno", label: "Ninguno identificado" },
];

const STEPS = [
    { id: 1, title: "Datos del Niño/a", icon: Baby },
    { id: 2, title: "Representante", icon: Users },
    { id: 3, title: "Domicilio", icon: MapPin },
    { id: 4, title: "Perfil Socioeconómico", icon: BarChart3 },
];

// ─── Component ─────────────────────────────────────────────
interface CreateApplicationDialogProps {
    children?: React.ReactNode;
    onSuccess?: () => void;
    applicationId?: number | null;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}



// ... previous imports ...

export function CreateApplicationDialog({ children, onSuccess, applicationId, open: controlledOpen, onOpenChange }: CreateApplicationDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    // Use controlled open state if provided, otherwise internal
    const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setIsOpen = onOpenChange || setInternalOpen;

    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);

    // Auth & License Admin State
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isLicenseAdmin, setIsLicenseAdmin] = useState(false);
    const [centers, setCenters] = useState<{ id: number, name: string }[]>([]);
    const [tenantId, setTenantId] = useState(""); // Selected Center ID

    useEffect(() => {
        const user = authService.getStoredUser();
        if (user) {
            setCurrentUser(user);
            const isAdmin = user.role === 'license_admin' || (user.role as any)?.name === 'license_admin';
            setIsLicenseAdmin(isAdmin);

            if (isAdmin) {
                licenseAdminService.getCenters().then(setCenters).catch(console.error);
            }
        }
    }, [isOpen]);

    // ── Step 1: Child ──
    const [childFirstName, setChildFirstName] = useState("");
    const [childLastName, setChildLastName] = useState("");
    const [childBirthDate, setChildBirthDate] = useState("");
    const [childGender, setChildGender] = useState("masculino");
    const [childCedula, setChildCedula] = useState("");

    // ── Step 2: Representative ──
    const [repFirstName, setRepFirstName] = useState("");
    const [repLastName, setRepLastName] = useState("");
    const [repCedula, setRepCedula] = useState("");
    const [repPhone, setRepPhone] = useState("");
    const [repEmail, setRepEmail] = useState("");
    const [repRelationship, setRepRelationship] = useState("madre");
    const [repOccupation, setRepOccupation] = useState("");
    const [repBirthPlace, setRepBirthPlace] = useState("");
    const [repBirthProvince, setRepBirthProvince] = useState("");
    const [repNationality, setRepNationality] = useState("Ecuatoriana");

    // ── Step 3: Address/Residence ──
    const [familyAddress, setFamilyAddress] = useState("");
    const [familyCity, setFamilyCity] = useState("");
    const [familyProvince, setFamilyProvince] = useState("");
    const [familySector, setFamilySector] = useState("");
    const [familyNeighborhood, setFamilyNeighborhood] = useState("");
    const [familyPhone, setFamilyPhone] = useState("");
    const [residencyYears, setResidencyYears] = useState("");
    const [previousAddress, setPreviousAddress] = useState("");
    const [previousCity, setPreviousCity] = useState("");

    // ── Step 4: Socioeconomic ──
    const [housingType, setHousingType] = useState("");
    const [employmentType, setEmploymentType] = useState("");
    const [incomeRange, setIncomeRange] = useState("");
    const [householdType, setHouseholdType] = useState("");
    const [economicCondition, setEconomicCondition] = useState("");
    const [geographicZone, setGeographicZone] = useState("");
    const [ethnicIdentity, setEthnicIdentity] = useState("");
    const [hasDisability, setHasDisability] = useState(false);
    const [disabilityDetail, setDisabilityDetail] = useState("");
    const [mobilityStatus, setMobilityStatus] = useState("no_aplica");
    const [migrantOrigin, setMigrantOrigin] = useState("");
    const [socialRisks, setSocialRisks] = useState<string[]>([]);

    // ── Helpers ──
    const resetForm = () => {
        setCurrentStep(1);
        setChildFirstName(""); setChildLastName(""); setChildBirthDate("");
        setChildGender("masculino"); setChildCedula(""); setTenantId("");
        setRepFirstName(""); setRepLastName(""); setRepCedula(""); setRepPhone("");
        setRepEmail(""); setRepRelationship("madre"); setRepOccupation("");
        setRepBirthPlace(""); setRepBirthProvince(""); setRepNationality("Ecuatoriana");
        setFamilyAddress(""); setFamilyCity(""); setFamilyProvince("");
        setFamilySector(""); setFamilyNeighborhood(""); setFamilyPhone("");
        setResidencyYears(""); setPreviousAddress(""); setPreviousCity("");
        setHousingType(""); setEmploymentType(""); setIncomeRange("");
        setHouseholdType(""); setEconomicCondition(""); setGeographicZone("");
        setEthnicIdentity(""); setHasDisability(false); setDisabilityDetail("");
        setMobilityStatus("no_aplica"); setMigrantOrigin(""); setSocialRisks([]);
    };

    const toggleSocialRisk = (value: string) => {
        setSocialRisks(prev =>
            prev.includes(value) ? prev.filter(r => r !== value) : [...prev, value]
        );
    };

    // ── Validation per step ──
    const isStep1Valid = useMemo(() => {
        const basicValid = !!childFirstName && !!childLastName && !!childBirthDate && !!childGender;
        if (isLicenseAdmin) {
            return basicValid && !!tenantId;
        }
        return basicValid;
    }, [childFirstName, childLastName, childBirthDate, childGender, isLicenseAdmin, tenantId]);

    const isStep2Valid = useMemo(() => {
        return !!repFirstName && !!repLastName && !!repCedula && !!repRelationship;
    }, [repFirstName, repLastName, repCedula, repRelationship]);

    const isStep3Valid = useMemo(() => {
        return !!familyAddress && !!familyCity && !!familyProvince;
    }, [familyAddress, familyCity, familyProvince]);

    const isStep4Valid = useMemo(() => {
        return !!housingType && !!incomeRange && !!householdType;
    }, [housingType, incomeRange, householdType]);

    const isCurrentStepValid = useMemo(() => {
        switch (currentStep) {
            case 1: return isStep1Valid;
            case 2: return isStep2Valid;
            case 3: return isStep3Valid;
            case 4: return isStep4Valid;
            default: return false;
        }
    }, [currentStep, isStep1Valid, isStep2Valid, isStep3Valid, isStep4Valid]);

    const handleSubmit = async () => {
        if (!isStep4Valid) return;
        setIsLoading(true);
        try {
            const applicationData: any = {
                // Step 1
                child_first_name: childFirstName,
                child_last_name: childLastName,
                child_birth_date: childBirthDate,
                child_gender: childGender,
                child_cedula: childCedula || null,
                // Step 2 (representative)
                representatives: [{
                    first_name: repFirstName,
                    last_name: repLastName,
                    cedula: repCedula,
                    phone: repPhone,
                    email: repEmail,
                    relationship: repRelationship,
                    occupation: repOccupation,
                    birth_place: repBirthPlace,
                    birth_province: repBirthProvince,
                    nationality: repNationality,
                    is_primary: true,
                }],
                // Step 3
                family_address: familyAddress,
                family_city: familyCity,
                family_province: familyProvince,
                family_sector: familySector,
                family_neighborhood: familyNeighborhood,
                family_phone_primary: familyPhone,
                residency_years: residencyYears ? parseInt(residencyYears) : null,
                previous_address: previousAddress || null,
                previous_city: previousCity || null,
                // Step 4
                housing_type: housingType,
                employment_type: employmentType,
                monthly_income_range: incomeRange,
                household_type: householdType,
                economic_condition: economicCondition,
                geographic_zone: geographicZone,
                ethnic_identity: ethnicIdentity,
                has_disability: hasDisability,
                disability_detail: hasDisability ? disabilityDetail : null,
                mobility_status: mobilityStatus,
                migrant_origin: mobilityStatus !== "no_aplica" ? migrantOrigin : null,
                social_risks: socialRisks,
            };

            if (isLicenseAdmin && tenantId) {
                applicationData.tenant_id = parseInt(tenantId);
            }

            if (applicationId) {
                // UPDATE
                await applicationsService.update(applicationId, applicationData);
            } else {
                // CREATE
                await applicationsService.create(applicationData);
            }

            setIsOpen(false);
            if (!applicationId) resetForm();
            onSuccess?.();
        } catch (error) {
            console.error(applicationId ? "Error updating application:" : "Error creating application:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Render Helpers ─────────────────────────────────────
    const renderSelectField = (
        id: string, label: string, value: string, onChange: (v: string) => void,
        options: { value: string; label: string }[], required = true
    ) => (
        <div className="space-y-2">
            <Label htmlFor={id}>{label} {required && <span className="text-destructive">*</span>}</Label>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger id={id} className={cn(!value && "text-muted-foreground")}>
                    <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                    {options.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );

    // ─── Steps ─────────────────────────────────────────────
    const renderStep1 = () => (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            {isLicenseAdmin && (
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 mb-4">
                    <Label htmlFor="centerSelect" className="text-primary font-semibold mb-2 block">
                        Centro Asignado <span className="text-destructive">*</span>
                    </Label>
                    <Select value={tenantId} onValueChange={setTenantId}>
                        <SelectTrigger id="centerSelect" className="bg-background">
                            <SelectValue placeholder="Seleccione el Centro para esta Solicitud" />
                        </SelectTrigger>
                        <SelectContent>
                            {centers.map(center => (
                                <SelectItem key={center.id} value={String(center.id)}>
                                    {center.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label htmlFor="childFirstName">Nombres <span className="text-destructive">*</span></Label>
                    <Input id="childFirstName" placeholder="Juan Carlos" value={childFirstName} onChange={(e) => setChildFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="childLastName">Apellidos <span className="text-destructive">*</span></Label>
                    <Input id="childLastName" placeholder="García López" value={childLastName} onChange={(e) => setChildLastName(e.target.value)} />
                </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                    <Label htmlFor="childBirthDate">Fecha Nacimiento <span className="text-destructive">*</span></Label>
                    <Input id="childBirthDate" type="date" value={childBirthDate} onChange={(e) => setChildBirthDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="childGender">Género <span className="text-destructive">*</span></Label>
                    <Select value={childGender} onValueChange={setChildGender}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="masculino">Masculino</SelectItem>
                            <SelectItem value="femenino">Femenino</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="childCedula">Cédula</Label>
                    <Input id="childCedula" placeholder="1234567890" value={childCedula} onChange={(e) => setChildCedula(e.target.value)} maxLength={10} />
                </div>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label>Nombres <span className="text-destructive">*</span></Label>
                    <Input placeholder="María" value={repFirstName} onChange={(e) => setRepFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label>Apellidos <span className="text-destructive">*</span></Label>
                    <Input placeholder="López Pérez" value={repLastName} onChange={(e) => setRepLastName(e.target.value)} />
                </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
                {renderSelectField("repRelationship", "Parentesco", repRelationship, setRepRelationship, [
                    { value: "madre", label: "Madre" },
                    { value: "padre", label: "Padre" },
                    { value: "abuelo", label: "Abuelo/a" },
                    { value: "tio", label: "Tío/a" },
                    { value: "tutor_legal", label: "Tutor legal" },
                    { value: "otro", label: "Otro" },
                ])}
                <div className="space-y-2">
                    <Label>Teléfono <span className="text-destructive">*</span></Label>
                    <Input placeholder="0991234567" value={repPhone} onChange={(e) => setRepPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label>Cédula</Label>
                    <Input placeholder="1234567890" value={repCedula} onChange={(e) => setRepCedula(e.target.value)} maxLength={10} />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" placeholder="correo@email.com" value={repEmail} onChange={(e) => setRepEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label>Ocupación</Label>
                    <Input placeholder="Comerciante" value={repOccupation} onChange={(e) => setRepOccupation(e.target.value)} />
                </div>
            </div>
            <div className="border-t pt-4 mt-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3 font-medium">Datos de Origen</p>
                <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                        <Label>Lugar de nacimiento <span className="text-destructive">*</span></Label>
                        <Input placeholder="Guayaquil" value={repBirthPlace} onChange={(e) => setRepBirthPlace(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Provincia <span className="text-destructive">*</span></Label>
                        <Input placeholder="Guayas" value={repBirthProvince} onChange={(e) => setRepBirthProvince(e.target.value)} />
                    </div>
                    {renderSelectField("repNationality", "Nacionalidad", repNationality, setRepNationality, NATIONALITY_OPTIONS)}
                </div>
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label>Dirección actual <span className="text-destructive">*</span></Label>
                    <Input placeholder="Av. Principal 123" value={familyAddress} onChange={(e) => setFamilyAddress(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label>Ciudad <span className="text-destructive">*</span></Label>
                    <Input placeholder="Guayaquil" value={familyCity} onChange={(e) => setFamilyCity(e.target.value)} />
                </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                    <Label>Provincia <span className="text-destructive">*</span></Label>
                    <Input placeholder="Guayas" value={familyProvince} onChange={(e) => setFamilyProvince(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label>Sector / Parroquia <span className="text-destructive">*</span></Label>
                    <Input placeholder="Ximena" value={familySector} onChange={(e) => setFamilySector(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label>Barrio</Label>
                    <Input placeholder="Los Esteros" value={familyNeighborhood} onChange={(e) => setFamilyNeighborhood(e.target.value)} />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label>Teléfono de contacto</Label>
                    <Input placeholder="0991234567" value={familyPhone} onChange={(e) => setFamilyPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label>Años en dirección actual <span className="text-destructive">*</span></Label>
                    <Input type="number" placeholder="3" min="0" max="99" value={residencyYears} onChange={(e) => setResidencyYears(e.target.value)} />
                </div>
            </div>

            {/* Conditional: show previous address if < 5 years */}
            {residencyYears && parseInt(residencyYears) < 5 && (
                <div className="border-t pt-4 mt-2 animate-in fade-in-0 duration-300">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3 font-medium">Dirección anterior (últimos 5 años)</p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label>Dirección anterior</Label>
                            <Input placeholder="Calle Secundaria 456" value={previousAddress} onChange={(e) => setPreviousAddress(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Ciudad anterior</Label>
                            <Input placeholder="Quito" value={previousCity} onChange={(e) => setPreviousCity(e.target.value)} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderStep4 = () => (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            <div className="grid grid-cols-2 gap-3">
                {renderSelectField("housingType", "Tipo de vivienda", housingType, setHousingType, HOUSING_OPTIONS)}
                {renderSelectField("employmentType", "Empleo jefe de hogar", employmentType, setEmploymentType, EMPLOYMENT_OPTIONS)}
            </div>
            <div className="grid grid-cols-2 gap-3">
                {renderSelectField("incomeRange", "Ingreso mensual familiar", incomeRange, setIncomeRange, INCOME_OPTIONS)}
                {renderSelectField("householdType", "Tipo de hogar", householdType, setHouseholdType, HOUSEHOLD_OPTIONS)}
            </div>
            <div className="grid grid-cols-2 gap-3">
                {renderSelectField("economicCondition", "Condición económica", economicCondition, setEconomicCondition, ECONOMIC_OPTIONS)}
                {renderSelectField("geographicZone", "Zona geográfica", geographicZone, setGeographicZone, GEOGRAPHIC_OPTIONS)}
            </div>
            <div className="grid grid-cols-2 gap-3">
                {renderSelectField("ethnicIdentity", "Autoidentificación étnica", ethnicIdentity, setEthnicIdentity, ETHNIC_OPTIONS)}
                {renderSelectField("mobilityStatus", "Movilidad humana", mobilityStatus, setMobilityStatus, MOBILITY_OPTIONS)}
            </div>

            {/* Conditional: migrant origin */}
            {mobilityStatus && mobilityStatus !== "no_aplica" && (
                <div className="animate-in fade-in-0 duration-300">
                    <div className="space-y-2">
                        <Label>País / región de origen <span className="text-destructive">*</span></Label>
                        <Input placeholder="Venezuela, Caracas" value={migrantOrigin} onChange={(e) => setMigrantOrigin(e.target.value)} />
                    </div>
                </div>
            )}

            {/* Disability toggle */}
            <div className="border-t pt-4 mt-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="disability-toggle" className="cursor-pointer">¿Algún miembro del hogar tiene discapacidad?</Label>
                    <Switch id="disability-toggle" checked={hasDisability} onCheckedChange={setHasDisability} />
                </div>
                {hasDisability && (
                    <div className="mt-3 animate-in fade-in-0 duration-300">
                        <Input placeholder="Detalle de la discapacidad" value={disabilityDetail} onChange={(e) => setDisabilityDetail(e.target.value)} />
                    </div>
                )}
            </div>

            {/* Social risks (checkboxes) */}
            <div className="border-t pt-4 mt-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3 font-medium">
                    Riesgos sociales identificados <span className="text-destructive">*</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                    {SOCIAL_RISK_OPTIONS.map(risk => (
                        <label key={risk.value} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded-md px-2 py-1.5 transition-colors">
                            <Checkbox
                                checked={socialRisks.includes(risk.value)}
                                onCheckedChange={() => toggleSocialRisk(risk.value)}
                            />
                            {risk.label}
                        </label>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open && !applicationId) resetForm(); }}>
            {children && <DialogTrigger asChild>{children}</DialogTrigger>}
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-lg p-0">
                {isFetching ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
                        <p className="text-muted-foreground">Cargando datos...</p>
                    </div>
                ) : (
                    <>
                        {/* ── Stepper Header ── */}
                        <div className="border-b px-6 pt-6 pb-4">
                            <DialogHeader className="mb-4">
                                <DialogTitle>{applicationId ? "Editar Postulación" : "Nueva Postulación"}</DialogTitle>
                                <DialogDescription>
                                    {applicationId ? "Modifique los datos necesarios." : "Complete todos los datos para crear la solicitud de admisión."}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex items-center justify-between">
                                {STEPS.map((step, idx) => (
                                    <div key={step.id} className="flex items-center flex-1">
                                        <div className="flex flex-col items-center gap-1">
                                            <div className={cn(
                                                "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                                                currentStep === step.id
                                                    ? "border-primary bg-primary text-primary-foreground scale-110"
                                                    : currentStep > step.id
                                                        ? "border-primary bg-primary/20 text-primary"
                                                        : "border-muted-foreground/30 text-muted-foreground/50"
                                            )}>
                                                {currentStep > step.id ? (
                                                    <Check className="h-4 w-4" />
                                                ) : (
                                                    <step.icon className="h-4 w-4" />
                                                )}
                                            </div>
                                            <span className={cn(
                                                "text-[10px] font-medium transition-colors",
                                                currentStep === step.id ? "text-primary" : "text-muted-foreground/60"
                                            )}>
                                                {step.title}
                                            </span>
                                        </div>
                                        {idx < STEPS.length - 1 && (
                                            <div className={cn(
                                                "flex-1 h-0.5 mx-2 mt-[-16px] transition-colors duration-300",
                                                currentStep > step.id ? "bg-primary" : "bg-muted-foreground/20"
                                            )} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ── Form Body ── */}
                        <div className="px-6 py-4 min-h-[320px]">
                            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-4">
                                {STEPS[currentStep - 1].title}
                            </h4>
                            {currentStep === 1 && renderStep1()}
                            {currentStep === 2 && renderStep2()}
                            {currentStep === 3 && renderStep3()}
                            {currentStep === 4 && renderStep4()}
                        </div>

                        {/* ── Footer Navigation ── */}
                        <div className="border-t px-6 py-4 flex items-center justify-between">
                            {currentStep > 1 ? (
                                <Button type="button" variant="ghost" onClick={() => setCurrentStep(s => s - 1)}>
                                    <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
                                </Button>
                            ) : (
                                <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                                    Cancelar
                                </Button>
                            )}

                            {currentStep < 4 ? (
                                <Button
                                    type="button"
                                    disabled={!isCurrentStepValid}
                                    onClick={() => setCurrentStep(s => s + 1)}
                                >
                                    Continuar <ChevronRight className="ml-1 h-4 w-4" />
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    disabled={!isCurrentStepValid || isLoading}
                                    onClick={handleSubmit}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    {isLoading ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
                                    ) : (
                                        <><Save className="mr-2 h-4 w-4" /> {applicationId ? "Actualizar Datos" : "Guardar Postulación"}</>
                                    )}
                                </Button>
                            )}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
