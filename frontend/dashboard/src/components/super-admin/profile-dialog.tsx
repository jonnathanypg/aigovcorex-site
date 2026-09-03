"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User as UserIcon, Lock } from "lucide-react";
import { authService } from "@/services/auth.service";
import type { User } from "@/types";

interface ProfileDialogProps {
    children: React.ReactNode;
}

export function ProfileDialog({ children }: ProfileDialogProps) {
    const [open, setOpen] = useState(false);
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        if (open) {
            const currentUser = authService.getStoredUser();
            setUser(currentUser);
        }
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Perfil de Usuario</DialogTitle>
                    <DialogDescription>
                        Gestiona tu información personal y seguridad.
                    </DialogDescription>
                </DialogHeader>

                {user && (
                    <Tabs defaultValue="profile" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="profile">
                                <UserIcon className="mr-2 h-4 w-4" />
                                Datos
                            </TabsTrigger>
                            <TabsTrigger value="security">
                                <Lock className="mr-2 h-4 w-4" />
                                Seguridad
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="profile">
                            <ProfileForm user={user} onUpdate={setUser} />
                        </TabsContent>

                        <TabsContent value="security">
                            <PasswordForm />
                        </TabsContent>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    );
}

function ProfileForm({ user, onUpdate }: { user: User; onUpdate: (user: User) => void }) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [firstName, setFirstName] = useState(user.first_name);
    const [lastName, setLastName] = useState(user.last_name);
    const [email, setEmail] = useState(user.email);
    const [phone, setPhone] = useState(user.phone || "");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const updatedUser = await authService.updateProfile({
                first_name: firstName,
                last_name: lastName,
                email,
                phone
            });
            onUpdate(updatedUser);
            setSuccess("Perfil actualizado correctamente");
        } catch (err: any) {
            setError(err.response?.data?.error || "Error al actualizar perfil");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {error && <div className="text-sm text-destructive">{error}</div>}
            {success && <div className="text-sm text-green-600">{success}</div>}

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="firstName">Nombres</Label>
                    <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="lastName">Apellidos</Label>
                    <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                />
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Guardar Cambios
            </Button>
        </form>
    );
}

function PasswordForm() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            setError("Las contraseñas no coinciden");
            return;
        }

        if (newPassword.length < 8) {
            setError("La contraseña debe tener al menos 8 caracteres");
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            await authService.changePassword(currentPassword, newPassword);
            setSuccess("Contraseña actualizada correctamente");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err: any) {
            setError(err.response?.data?.error || "Error al cambiar contraseña");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {error && <div className="text-sm text-destructive">{error}</div>}
            {success && <div className="text-sm text-green-600">{success}</div>}

            <div className="space-y-2">
                <Label htmlFor="currentPassword">Contraseña Actual</Label>
                <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="newPassword">Nueva Contraseña</Label>
                <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Nueva Contraseña</Label>
                <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                />
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Actualizar Contraseña
            </Button>
        </form>
    );
}
