
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ChildRecordForm, formSchema, type ChildRecordFormValues } from './child-record-form';
import type { Child } from '@/types';

interface CreateEditChildDialogProps {
  children?: React.ReactNode;
  onSave: (data: ChildRecordFormValues) => void;
  recordToEdit?: Child | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const defaultValues: ChildRecordFormValues = {
  first_name: '',
  last_name: '',
  cedula: '',
  birth_date: '',
  gender: 'masculino',
  status: 'activo',
  allergies: '',
  medical_conditions: '',
  special_needs: '',
};

import { childrenService } from '@/services/children.service';
import { Loader2 } from 'lucide-react';

export function CreateEditChildDialog({ children, onSave, recordToEdit, open, onOpenChange }: CreateEditChildDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [loadedTenantId, setLoadedTenantId] = useState<number | null>(null);
  const isEditing = !!recordToEdit;

  // Controlled open state
  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  const form = useForm<ChildRecordFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues,
  });

  useEffect(() => {
    const loadChildDetails = async () => {
      if (isOpen && recordToEdit) {
        setIsLoadingDetails(true);
        try {
          // Fetch full details including family and reps
          const fullData = await childrenService.getById(recordToEdit.id);
          const child = fullData.child;
          const family = fullData.family || {};
          const reps = fullData.representatives || [];
          const primaryRep = reps.find((r: any) => r.is_primary) || reps[0] || {};

          const tenantId = child.tenant_id != null ? Number(child.tenant_id) : null;
          if (tenantId != null) setLoadedTenantId(tenantId);

          form.reset({
            id: child.id,
            first_name: child.first_name,
            last_name: child.last_name,
            cedula: child.cedula || '',
            birth_date: child.birth_date ? new Date(child.birth_date).toISOString().split('T')[0] : '',
            gender: child.gender as any,
            status: (child.status || 'activo').toLowerCase() as any,
            assigned_group: child.assigned_group || '',
            assigned_educator_id: (child as any).assigned_educator_id ?? null,
            center_id: tenantId != null ? String(tenantId) : undefined,

            // Health
            blood_type: (child as any).blood_type ?? '',
            allergies: child.allergies || '',
            medical_conditions: child.medical_conditions || '',
            special_needs: child.special_needs || '',
            has_disability: family.has_disability || false,
            disability_detail: family.disability_detail || '',

            // Family & Rep (Mapped from nested)
            rep_first_name: primaryRep.first_name || '',
            rep_last_name: primaryRep.last_name || '',
            rep_cedula: primaryRep.cedula || '',
            rep_relationship: primaryRep.relationship || '',
            rep_phone: primaryRep.phone || '',
            rep_email: primaryRep.email || '',

            family_address: family.address || '',
            family_city: family.city || '',
            family_sector: family.sector || '',
            family_phone_primary: family.phone_primary || '',
            emergency_contact_name: family.emergency_contact_name || '',
            emergency_contact_phone: family.emergency_contact_phone || '',
          });
        } catch (error) {
          console.error("Error loading child details:", error);
          form.reset({
            ...defaultValues,
            first_name: recordToEdit.first_name,
            last_name: recordToEdit.last_name
          });
          setLoadedTenantId(null);
        } finally {
          setIsLoadingDetails(false);
        }
      } else if (isOpen) {
        form.reset(defaultValues);
        setLoadedTenantId(null);
      }
    };

    loadChildDetails();
  }, [isOpen, recordToEdit, form]);

  const handleSave = (values: ChildRecordFormValues) => {
    // Construct Payload for API
    // We pass the flat values, the service/API will handle nested creation
    // But we need to structure it if the API expects nested 'representatives' array
    // Based on my backend update:
    // create_child expects: representatives: [{...}]
    // update_child expects: representatives: [{...}] to update primary

    const payload: any = { ...values };

    // Construct representatives array for the backend
    if (values.rep_first_name) {
      payload.representatives = [{
        first_name: values.rep_first_name,
        last_name: values.rep_last_name,
        cedula: values.rep_cedula,
        relationship: values.rep_relationship,
        phone: values.rep_phone,
        email: values.rep_email,
        is_primary: true
      }];
    }

    // Fix for License Admin: Backend expects 'tenant_id', form has 'center_id'
    if (values.center_id) {
      payload.tenant_id = values.center_id;
    }
    if (values.assigned_educator_id !== undefined) {
      payload.assigned_educator_id = values.assigned_educator_id;
    }

    onSave(payload);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-[700px] bg-background/95 backdrop-blur-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Ficha Integral' : 'Registrar Nuevo Niño/a'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modifique los datos completos del niño y su familia.' : 'Complete el formulario de registro.'}
          </DialogDescription>
        </DialogHeader>

        {isLoadingDetails ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          <ChildRecordForm
            form={form}
            onSubmit={handleSave}
            onCancel={() => setIsOpen(false)}
            isEditing={isEditing}
            effectiveTenantIdForEducators={isEditing ? loadedTenantId : undefined}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
