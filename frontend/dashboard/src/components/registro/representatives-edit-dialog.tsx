"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Pencil, Trash2, UserPlus } from "lucide-react";
import { childrenService } from "@/services/children.service";
import type { Child, Representative } from "@/types";
import { useToast } from "@/hooks/use-toast";

interface RepresentativesEditDialogProps {
    child: Child;
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

const repSchema = z.object({
    first_name: z.string().min(2, "Nombre requerido"),
    last_name: z.string().min(2, "Apellido requerido"),
    cedula: z.string().optional().or(z.literal('')),
    relationship: z.string().min(1, "Parentesco requerido"),
    phone: z.string().optional().or(z.literal('')),
    email: z.string().email("Email inválido").optional().or(z.literal('')),
    occupation: z.string().optional(),
    workplace: z.string().optional(),
    is_primary: z.boolean().default(false),
});

type RepFormValues = z.infer<typeof repSchema>;

export function RepresentativesEditDialog({ child, trigger, open, onOpenChange }: RepresentativesEditDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [reps, setReps] = useState<Representative[]>([]);
    const { toast } = useToast();

    const [editingRep, setEditingRep] = useState<Representative | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);

    // Controlled open state
    const isOpen = open !== undefined ? open : internalOpen;
    const setIsOpen = onOpenChange || setInternalOpen;

    const loadReps = async () => {
        try {
            setLoading(true);
            const data = await childrenService.getRepresentatives(child.id);
            setReps(data);
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "No se pudieron cargar los representantes", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && child) {
            loadReps();
        }
    }, [isOpen, child]);

    const handleDelete = async (repId: number) => {
        if (!confirm("¿Está seguro de eliminar este representante?")) return;
        try {
            await childrenService.deleteRepresentative(repId);
            toast({ title: "Éxito", description: "Representante eliminado" });
            loadReps();
        } catch (error) {
            toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
        }
    };

    const openAddForm = () => {
        setEditingRep(null);
        setIsFormOpen(true);
    };

    const openEditForm = (rep: Representative) => {
        setEditingRep(rep);
        setIsFormOpen(true);
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
                <DialogContent className="sm:max-w-[800px] bg-background/95 backdrop-blur-lg">
                    <DialogHeader>
                        <DialogTitle>Representantes: {child.full_name}</DialogTitle>
                        <DialogDescription>
                            Gestione la información de padres, madres y representantes legales.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <div className="flex justify-end mb-4">
                            <Button onClick={openAddForm} size="sm">
                                <Plus className="mr-2 h-4 w-4" /> Agregar Representante
                            </Button>
                        </div>

                        {loading ? (
                            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                        ) : (
                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nombre</TableHead>
                                            <TableHead>Parentesco</TableHead>
                                            <TableHead>Contacto</TableHead>
                                            <TableHead>Principal</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {reps.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-4">No hay representantes registrados</TableCell>
                                            </TableRow>
                                        ) : reps.map((rep) => (
                                            <TableRow key={rep.id}>
                                                <TableCell>
                                                    <div className="font-medium">{rep.full_name}</div>
                                                    <div className="text-xs text-muted-foreground">{rep.cedula}</div>
                                                </TableCell>
                                                <TableCell className="capitalize">{rep.relationship}</TableCell>
                                                <TableCell>
                                                    <div className="text-sm">{rep.phone}</div>
                                                    <div className="text-xs text-muted-foreground">{rep.email}</div>
                                                </TableCell>
                                                <TableCell>
                                                    {rep.is_primary && <span className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded-full">Principal</span>}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="icon" onClick={() => openEditForm(rep)}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(rep.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <RepFormDialog
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                childId={child.id}
                initialData={editingRep}
                onSuccess={() => {
                    setIsFormOpen(false);
                    loadReps();
                }}
            />
        </>
    );
}

function RepFormDialog({ open, onOpenChange, childId, initialData, onSuccess }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    childId: number;
    initialData: Representative | null;
    onSuccess: () => void;
}) {
    const { toast } = useToast();
    const form = useForm<RepFormValues>({
        resolver: zodResolver(repSchema),
        defaultValues: {
            first_name: "", last_name: "", cedula: "", relationship: "padre",
            phone: "", email: "", occupation: "", workplace: "", is_primary: false
        }
    });

    useEffect(() => {
        if (open) {
            form.reset(initialData ? {
                first_name: initialData.first_name,
                last_name: initialData.last_name,
                cedula: initialData.cedula || "",
                relationship: initialData.relationship,
                phone: initialData.phone || "",
                email: initialData.email || "",
                occupation: initialData.occupation || "",
                workplace: initialData.workplace || "",
                is_primary: initialData.is_primary
            } : {
                first_name: "", last_name: "", cedula: "", relationship: "padre",
                phone: "", email: "", occupation: "", workplace: "", is_primary: false
            });
        }
    }, [open, initialData, form]);

    const onSubmit = async (values: RepFormValues) => {
        try {
            if (initialData) {
                await childrenService.updateRepresentative(initialData.id, values);
                toast({ title: "Actualizado", description: "Datos guardados correctamente" });
            } else {
                await childrenService.addRepresentative(childId, values);
                toast({ title: "Creado", description: "Representante agregado correctamente" });
            }
            onSuccess();
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "No se pudo guardar", variant: "destructive" });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? 'Editar Representante' : 'Nuevo Representante'}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="first_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nombre</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="last_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Apellido</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
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
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="relationship"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Parentesco</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccione" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="padre">Padre</SelectItem>
                                                <SelectItem value="madre">Madre</SelectItem>
                                                <SelectItem value="abuelo">Abuelo/a</SelectItem>
                                                <SelectItem value="tio">Tío/a</SelectItem>
                                                <SelectItem value="otro">Otro</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Teléfono / Celular</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="is_primary"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                        <Input
                                            type="checkbox"
                                            className="h-4 w-4"
                                            checked={field.value}
                                            onChange={field.onChange}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>Representante Principal</FormLabel>
                                        <p className="text-sm text-muted-foreground">
                                            Recibirá las notificaciones y mensajes principales.
                                        </p>
                                    </div>
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button type="submit">Guardar</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
