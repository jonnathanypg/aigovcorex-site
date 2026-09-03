"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { licenseAdminService, type LicenseUser, type Center } from "@/services/license-admin.service";
import { useAgentRefresh } from "@/hooks/use-agent-refresh";
import { CreateUserDialog } from "./create-user-dialog";
import { EditUserDialog } from "./edit-user-dialog";
import { Plus, Search, Loader2, UserX, UserCheck, Pencil, Trash2, FileDown } from "lucide-react";
import { toast } from "sonner";

export function UsersClient() {
    const [users, setUsers] = useState<LicenseUser[]>([]);
    const [centers, setCenters] = useState<Center[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Edit state
    const [userToEdit, setUserToEdit] = useState<LicenseUser | null>(null);

    // Delete state
    const [userToDelete, setUserToDelete] = useState<number | null>(null);

    // Filters
    const [selectedCenter, setSelectedCenter] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");

    const loadData = useCallback(async () => {
        try {
            setIsLoading(true);
            const [usersData, centersData] = await Promise.all([
                licenseAdminService.getUsers(),
                licenseAdminService.getCenters()
            ]);
            setUsers(usersData);
            setCenters(centersData);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useAgentRefresh(loadData);

    const toggleUserStatus = async (user: LicenseUser) => {
        try {
            await licenseAdminService.updateUser(user.id, { is_active: !user.is_active });
            loadData(); // Refresh
            toast.success(user.is_active ? "Usuario desactivado" : "Usuario activado");
        } catch (error) {
            console.error("Error updating user:", error);
            toast.error("Error al actualizar estado del usuario");
        }
    };

    const handleDelete = async (userId: number) => {
        try {
            await licenseAdminService.deleteUser(userId);
            setUsers(users.filter(u => u.id !== userId));
            toast.success("Usuario eliminado correctamente");
        } catch (error: any) {
            console.error("Error deleting user:", error);
            toast.error(error.response?.data?.error || "Error al eliminar el usuario");
        } finally {
            setUserToDelete(null);
        }
    };

    const handleExportUsers = () => {
        try {
            if (filteredUsers.length === 0) {
                toast.error("No hay datos para exportar");
                return;
            }

            // Define headers
            const headers = ["Nombre", "Apellido", "Email", "Teléfono", "Rol", "Centro", "Estado"];
            
            // Convert users to CSV rows
            const rows = filteredUsers.map(u => [
                u.first_name,
                u.last_name,
                u.email,
                u.phone || "",
                u.role?.replace('_', ' ') || "",
                getCenterDisplayName(u),
                u.is_active ? "Activo" : "Inactivo"
            ]);

            // Combine
            const csvContent = [
                headers.join(","),
                ...rows.map(r => r.map(field => `"${String(field).replace(/"/g, '""')}"`).join(","))
            ].join("\n");

            // Create blob and download
            const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            const dateStr = new Date().toISOString().split('T')[0];
            
            link.setAttribute("href", url);
            link.setAttribute("download", `Personal_KindiCore_${dateStr}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            toast.success("Personal exportado correctamente");
        } catch (error) {
            console.error("Export error:", error);
            toast.error("Error al exportar el personal");
        }
    };

    // Helper to determine center display text
    const getCenterDisplayName = (user: LicenseUser) => {
        // License admins and super admins have access to all centers
        if (user.role === 'license_admin' || user.role === 'super_admin') {
            return 'Todos los Centros';
        }
        return user.center_name || 'Sin asignar';
    };

    const filteredUsers = users.filter(user => {
        const matchesCenter = selectedCenter === "all" || user.tenant_id?.toString() === selectedCenter;
        const matchesSearch =
            user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.phone && user.phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (user.role && user.role.toLowerCase().includes(searchTerm.toLowerCase()));

        return matchesCenter && matchesSearch;
    });

    // Check if user can be deleted (not admin roles)
    const canDeleteUser = (user: LicenseUser) => {
        return user.role !== 'license_admin' && user.role !== 'super_admin';
    };

    const renderActions = (user: LicenseUser) => (
        <>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setUserToEdit(user)}
                title="Editar usuario"
                className="h-8 w-8 p-0"
            >
                <Pencil className="h-4 w-4 text-blue-500" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleUserStatus(user)}
                title={user.is_active ? "Desactivar usuario" : "Activar usuario"}
                className="h-8 w-8 p-0"
            >
                {user.is_active ? (
                    <UserX className="h-4 w-4 text-orange-500" />
                ) : (
                    <UserCheck className="h-4 w-4 text-green-500" />
                )}
            </Button>

            {canDeleteUser(user) && (
                <AlertDialog open={userToDelete === user.id} onOpenChange={(open) => open ? setUserToDelete(user.id) : setUserToDelete(null)}>
                    <AlertDialogTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            title="Eliminar usuario"
                            className="h-8 w-8 p-0"
                        >
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción eliminará permanentemente a <strong>{user.first_name} {user.last_name}</strong> del sistema. Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(user.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Eliminar
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </>
    );

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-3xl font-bold tracking-tight font-headline">Gestión de Personal</CardTitle>
                        <CardDescription className="text-lg text-foreground/80">
                            Administre los usuarios y roles de sus centros educativos.
                        </CardDescription>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        <Button 
                            variant="outline" 
                            onClick={handleExportUsers} 
                            className="w-full sm:w-auto border-primary/20 hover:bg-primary/5 text-primary"
                        >
                            <FileDown className="mr-2 h-4 w-4" />
                            Exportar Personal
                        </Button>
                        <Button onClick={() => setIsCreateOpen(true)} className="w-full sm:w-auto shadow-lg shadow-primary/20">
                            <Plus className="mr-2 h-4 w-4" />
                            Nuevo Usuario
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Card className="bg-card/30 backdrop-blur-sm border-border/20">
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre, email o rol..."
                                className="pl-10 bg-background/50 border-border/40 focus:bg-background transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="w-full md:w-[250px]">
                            <Select value={selectedCenter} onValueChange={setSelectedCenter}>
                                <SelectTrigger className="bg-background/50 border-border/40 focus:ring-primary/20">
                                    <SelectValue placeholder="Filtrar por Centro" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los Centros</SelectItem>
                                    {centers.map(center => (
                                        <SelectItem key={center.id} value={center.id.toString()}>
                                            {center.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="border rounded-xl overflow-hidden bg-card/20 border-border/30 shadow-inner">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hidden md:table-row hover:bg-transparent">
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Teléfono</TableHead>
                                        <TableHead>Rol</TableHead>
                                        <TableHead>Centro Asignado</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                                No se encontraron usuarios.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredUsers.map((user) => (
                                            <React.Fragment key={user.id}>
                                                {/* Mobile View Card */}
                                                <TableRow className="md:hidden flex flex-col p-4 space-y-3 border-b border-border/10">
                                                    <TableCell className="p-0 border-0 flex justify-between items-start">
                                                        <div>
                                                            <div className="font-bold text-lg">{user.first_name} {user.last_name}</div>
                                                            <div className="text-sm text-muted-foreground">{user.email}</div>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            {renderActions(user)}
                                                        </div>
                                                    </TableCell>

                                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs text-muted-foreground font-semibold uppercase">Rol</span>
                                                            <div className="mt-1">
                                                                <Badge variant="outline" className="capitalize text-[10px] sm:text-xs">
                                                                    {user.role?.replace('_', ' ')}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs text-muted-foreground font-semibold uppercase">Estado</span>
                                                            <div className="mt-1">
                                                                {user.is_active ? (
                                                                    <Badge className="bg-green-500 hover:bg-green-600 text-[10px] sm:text-xs">Activo</Badge>
                                                                ) : (
                                                                    <Badge variant="destructive" className="text-[10px] sm:text-xs">Inactivo</Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col space-y-1 bg-muted/30 p-2 rounded text-sm">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-muted-foreground">Asignación:</span>
                                                            <span className={`font-medium ${user.role === 'license_admin' || user.role === 'super_admin' ? 'text-primary' : ''}`}>
                                                                {getCenterDisplayName(user)}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-muted-foreground">Teléfono:</span>
                                                            <span>{user.phone || '-'}</span>
                                                        </div>
                                                    </div>
                                                </TableRow>

                                                {/* Desktop View Row */}
                                                <TableRow className="hidden md:table-row hover:bg-white/5">
                                                    <TableCell className="font-medium">
                                                        {user.first_name} {user.last_name}
                                                    </TableCell>
                                                    <TableCell className="max-w-[200px] truncate" title={user.email}>
                                                        {user.email}
                                                    </TableCell>
                                                    <TableCell>{user.phone || '-'}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="capitalize">
                                                            {user.role?.replace('_', ' ')}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className={user.role === 'license_admin' || user.role === 'super_admin' ? 'text-primary font-medium' : ''}>
                                                            {getCenterDisplayName(user)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        {user.is_active ? (
                                                            <Badge className="bg-green-500 hover:bg-green-600">Activo</Badge>
                                                        ) : (
                                                            <Badge variant="destructive">Inactivo</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1">
                                                            {renderActions(user)}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            </React.Fragment>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <CreateUserDialog
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                onSuccess={loadData}
            />

            <EditUserDialog
                open={!!userToEdit}
                onOpenChange={(open) => !open && setUserToEdit(null)}
                user={userToEdit}
                onSuccess={loadData}
            />
        </div>
    );
}
