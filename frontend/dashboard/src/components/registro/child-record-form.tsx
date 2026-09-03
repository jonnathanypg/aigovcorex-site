"use client";

import { useState, useEffect } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import {
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { authService } from '@/services/auth.service';
import { licenseAdminService } from '@/services/license-admin.service';
import { childrenService, type CenterEducator } from '@/services/children.service';

// ─── Schema ─────────────────────────────────────────────────────────

export const formSchema = z.object({
  id: z.number().optional(),
  // Tab 1: Niño
  first_name: z.string().min(2, 'El nombre es requerido'),
  last_name: z.string().min(2, 'El apellido es requerido'),
  cedula: z.string().optional().or(z.literal('')),
  birth_date: z.string().min(1, 'La fecha de nacimiento es requerida'),
  gender: z.enum(['masculino', 'femenino']),
  center_id: z.string().optional(), // For license admins
  status: z.enum(['activo', 'inactivo', 'egresado', 'lista_espera']),
  assigned_group: z.string().optional(),
  assigned_educator_id: z.number().optional().nullable(),

  // Tab 2: Familia (Primary Rep & Address)
  // Representative (Primary)
  rep_first_name: z.string().optional(),
  rep_last_name: z.string().optional(),
  rep_cedula: z.string().optional(),
  rep_relationship: z.string().optional(),
  rep_phone: z.string().optional(),
  rep_email: z.string().optional(),

  // Family Address
  family_address: z.string().optional(),
  family_city: z.string().optional(),
  family_sector: z.string().optional(),
  family_phone_primary: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),

  // Tab 3: Salud y Otros
  blood_type: z.string().optional(),
  allergies: z.string().optional(),
  medical_conditions: z.string().optional(),
  special_needs: z.string().optional(),
  has_disability: z.boolean().optional(),
  disability_detail: z.string().optional(),
});

export type ChildRecordFormValues = z.infer<typeof formSchema>;

// ─── Component ──────────────────────────────────────────────────────

interface ChildRecordFormProps {
  form: UseFormReturn<ChildRecordFormValues>;
  onSubmit: (values: ChildRecordFormValues) => void;
  onCancel: () => void;
  isEditing: boolean;
  /** Cuando se edita, el centro del niño; así el campo educadora se muestra aunque center_id tarde en actualizarse */
  effectiveTenantIdForEducators?: number | null;
}

export function ChildRecordForm({ form, onSubmit, onCancel, isEditing, effectiveTenantIdForEducators }: ChildRecordFormProps) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [centers, setCenters] = useState<{ id: number, name: string }[]>([]);
  const [loadingCenters, setLoadingCenters] = useState(false);
  const [educators, setEducators] = useState<CenterEducator[]>([]);
  const [loadingEducators, setLoadingEducators] = useState(false);
  const [noEducatorQuota, setNoEducatorQuota] = useState(false);
  const [activeTab, setActiveTab] = useState("child");

  useEffect(() => {
    const user = authService.getStoredUser();
    if (user) {
      setCurrentUser(user);
      const rName = typeof user.role === 'string' ? user.role : (user.role as any)?.name;
      // If license admin or multi-center role, fetch centers
      if (['license_admin', 'supervisor', 'doctor'].includes(rName)) {
        fetchCenters();
      }
    }
  }, []);

  const fetchCenters = async () => {
    try {
      setLoadingCenters(true);
      const data = await licenseAdminService.getCenters();
      setCenters(data);
    } catch (error) {
      console.error("Error fetching centers:", error);
    } finally {
      setLoadingCenters(false);
    }
  };

  const roleName = typeof currentUser?.role === 'string' ? currentUser.role : (currentUser?.role as any)?.name;
  const isLicenseAdmin = ['license_admin', 'supervisor', 'doctor'].includes(roleName);
  const tenantIdForEducators = isLicenseAdmin
    ? (form.watch('center_id') ? Number(form.watch('center_id')) : (effectiveTenantIdForEducators ?? null))
    : (currentUser?.tenant_id ?? null);

  useEffect(() => {
    if (!tenantIdForEducators) {
      setEducators([]);
      setNoEducatorQuota(false);
      return;
    }
    let cancelled = false;
    setLoadingEducators(true);
    setNoEducatorQuota(false);
    childrenService.getEducators(tenantIdForEducators).then((res) => {
      if (cancelled) return;
      setEducators(res.educators);
      const withQuota = res.educators.filter((e) => e.has_quota);
      setNoEducatorQuota(withQuota.length === 0 && res.educators.length > 0);
      setLoadingEducators(false);
    }).catch(() => {
      if (!cancelled) setLoadingEducators(false);
    });
    return () => { cancelled = true; };
  }, [tenantIdForEducators]);

  const educatorsWithQuota = educators.filter((e) => e.has_quota);
  const canAssignEducator = isLicenseAdmin || roleName === 'center_coordinator' || roleName === 'coordinator';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="child">Datos del Niño</TabsTrigger>
            <TabsTrigger value="family">Familia</TabsTrigger>
            <TabsTrigger value="health">Salud</TabsTrigger>
          </TabsList>

          {/* ─── Tab 1: Datos del Niño ─── */}
          <TabsContent value="child" className="space-y-4 mt-4 animate-in slide-in-from-right-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombres <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input placeholder="Juan Carlos" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apellidos <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input placeholder="Pérez López" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cedula"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cédula</FormLabel>
                    <FormControl><Input placeholder="099..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="birth_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha Nacimiento</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Género</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="femenino">Femenino</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="activo">Activo</SelectItem>
                        <SelectItem value="inactivo">Inactivo</SelectItem>
                        <SelectItem value="egresado">Egresado</SelectItem>
                        <SelectItem value="lista_espera">Lista de Espera</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isLicenseAdmin && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="center_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Centro Asignado</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isEditing || loadingCenters}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={loadingCenters ? "Cargando..." : "Seleccione Centro"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {centers.map(center => (
                            <SelectItem key={center.id} value={String(center.id)}>{center.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div></div>
              </div>
            )}

            {/* Educadora asignada: solo coordinador o license_admin */}
            {canAssignEducator && (tenantIdForEducators || !isLicenseAdmin) && (
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="assigned_educator_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Educadora asignada</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === '__none__' ? null : Number(v))}
                        value={field.value == null ? '__none__' : String(field.value)}
                        disabled={loadingEducators || (educatorsWithQuota.length === 0 && !field.value)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={loadingEducators ? 'Cargando...' : noEducatorQuota ? 'Sin cupo disponible' : 'Seleccione educadora'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">Sin asignar</SelectItem>
                          {educatorsWithQuota.map((e) => (
                            <SelectItem key={e.id} value={String(e.id)}>
                              {e.full_name} ({e.assigned_count}/{e.max_per_educator})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {noEducatorQuota && educatorsWithQuota.length === 0 && (
                        <p className="text-sm text-amber-600">No hay educadoras con cupo de asignación en este centro.</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* If Admin, show Status separately or reuse layout */}
            {isLicenseAdmin && (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="activo">Activo</SelectItem>
                        <SelectItem value="inactivo">Inactivo</SelectItem>
                        <SelectItem value="egresado">Egresado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </TabsContent>

          {/* ─── Tab 2: Familia ─── */}
          <TabsContent value="family" className="space-y-4 mt-4 animate-in slide-in-from-right-4">
            <div className="bg-muted/30 p-3 rounded-md border mb-4">
              <h4 className="text-sm font-medium mb-3 text-primary">Representante Principal</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="rep_first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombres</FormLabel>
                      <FormControl><Input placeholder="María" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rep_last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellidos</FormLabel>
                      <FormControl><Input placeholder="López" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <FormField
                  control={form.control}
                  name="rep_relationship"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parentesco</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="madre">Madre</SelectItem>
                          <SelectItem value="padre">Padre</SelectItem>
                          <SelectItem value="abuela">Abuela</SelectItem>
                          <SelectItem value="abuelo">Abuelo</SelectItem>
                          <SelectItem value="tio">Tío/a</SelectItem>
                          <SelectItem value="otro">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rep_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl><Input placeholder="099..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="family_city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ciudad Domicilio</FormLabel>
                    <FormControl><Input placeholder="Guayaquil" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="family_sector"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sector</FormLabel>
                    <FormControl><Input placeholder="Norte" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="family_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección Completa</FormLabel>
                  <FormControl><Textarea placeholder="Calle Principal y Secundaria..." className="resize-none h-20" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="emergency_contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contacto Emergencia</FormLabel>
                    <FormControl><Input placeholder="Nombre contacto" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="emergency_contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono Emergencia</FormLabel>
                    <FormControl><Input placeholder="099..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>

          {/* ─── Tab 3: Salud ─── */}
          <TabsContent value="health" className="space-y-4 mt-4 animate-in slide-in-from-right-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="blood_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Sangre</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="O+">O+</SelectItem>
                        <SelectItem value="O-">O-</SelectItem>
                        <SelectItem value="A+">A+</SelectItem>
                        <SelectItem value="A-">A-</SelectItem>
                        <SelectItem value="B+">B+</SelectItem>
                        <SelectItem value="B-">B-</SelectItem>
                        <SelectItem value="AB+">AB+</SelectItem>
                        <SelectItem value="AB-">AB-</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="has_disability"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Discapacidad</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {form.watch('has_disability') && (
              <FormField
                control={form.control}
                name="disability_detail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Detalle Discapacidad</FormLabel>
                    <FormControl><Input placeholder="Detalle..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="allergies"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alergias</FormLabel>
                  <FormControl><Textarea placeholder="Ninguna" className="resize-none" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="medical_conditions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Condiciones Médicas</FormLabel>
                  <FormControl><Textarea placeholder="Ninguna" className="resize-none" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          {activeTab === "child" && (
            <Button type="button" onClick={() => setActiveTab("family")}>
              Siguiente
            </Button>
          )}
          {activeTab === "family" && (
            <>
              <Button type="button" variant="ghost" onClick={() => setActiveTab("child")}>
                Atrás
              </Button>
              <Button type="button" onClick={() => setActiveTab("health")}>
                Siguiente
              </Button>
            </>
          )}
          {activeTab === "health" && (
            <>
              <Button type="button" variant="ghost" onClick={() => setActiveTab("family")}>
                Atrás
              </Button>
              <Button type="submit">Guardar Registro</Button>
            </>
          )}
        </DialogFooter>
      </form>
    </Form>
  );
}
