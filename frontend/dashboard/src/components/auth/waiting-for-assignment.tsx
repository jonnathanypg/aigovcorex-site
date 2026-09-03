"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LogOut, Clock, User, Save } from "lucide-react";
import { authService } from "@/services/auth.service";
import type { User as UserType } from "@/types";

/**
 * WaitingForAssignment - Shown to users without an assigned center.
 * Allows profile editing and logout only.
 */
export function WaitingForAssignment() {
    const [user, setUser] = useState<UserType | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Form state
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");

    // Password change
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    useEffect(() => {
        const storedUser = authService.getStoredUser();
        if (storedUser) {
            setUser(storedUser);
            setFirstName(storedUser.first_name);
            setLastName(storedUser.last_name);
            setEmail(storedUser.email);
            setPhone(storedUser.phone || "");
        }
        setIsLoading(false);
    }, []);

    const handleSaveProfile = async () => {
        setIsSaving(true);
        setMessage(null);
        try {
            const updatedUser = await authService.updateProfile({
                first_name: firstName,
                last_name: lastName,
                email,
                phone,
            });
            setUser(updatedUser);
            setMessage({ type: 'success', text: 'Perfil actualizado correctamente' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Error al actualizar perfil' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Las contraseñas no coinciden' });
            return;
        }
        setIsSaving(true);
        setMessage(null);
        try {
            await authService.changePassword(currentPassword, newPassword);
            setMessage({ type: 'success', text: 'Contraseña actualizada correctamente' });
            setShowPasswordForm(false);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (error: any) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Error al cambiar contraseña' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = () => {
        authService.logout();
    };

    if (isLoading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
            <div className="w-full max-w-lg space-y-6">
                {/* Status Card */}
                <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
                    <CardHeader className="text-center">
                        <div className="mx-auto p-4 bg-amber-100 dark:bg-amber-900/30 rounded-full w-fit mb-4">
                            <Clock className="h-10 w-10 text-amber-600 dark:text-amber-400" />
                        </div>
                        <CardTitle className="text-2xl">A la espera de asignación</CardTitle>
                        <CardDescription className="text-base">
                            Tu cuenta ha sido creada pero aún no tienes un centro asignado.
                            El administrador de tu licencia te asignará a un centro pronto.
                        </CardDescription>
                    </CardHeader>
                </Card>

                {/* Profile Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Mi Perfil
                        </CardTitle>
                        <CardDescription>
                            Mientras esperas, puedes completar tu información de perfil.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {message && (
                            <div className={`p-3 rounded-md text-sm ${message.type === 'success'
                                    ? 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400'
                                    : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400'
                                }`}>
                                {message.text}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">Nombre</Label>
                                <Input
                                    id="firstName"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName">Apellido</Label>
                                <Input
                                    id="lastName"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">Teléfono</Label>
                            <Input
                                id="phone"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="Ej: 0991234567"
                            />
                        </div>

                        <Button onClick={handleSaveProfile} disabled={isSaving} className="w-full">
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            Guardar Cambios
                        </Button>

                        {/* Password Section */}
                        <div className="pt-4 border-t">
                            {!showPasswordForm ? (
                                <Button variant="outline" onClick={() => setShowPasswordForm(true)} className="w-full">
                                    Cambiar Contraseña
                                </Button>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="currentPassword">Contraseña Actual</Label>
                                        <Input
                                            id="currentPassword"
                                            type="password"
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="newPassword">Nueva Contraseña</Label>
                                        <Input
                                            id="newPassword"
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                                        <Input
                                            id="confirmPassword"
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" onClick={() => setShowPasswordForm(false)} className="flex-1">
                                            Cancelar
                                        </Button>
                                        <Button onClick={handleChangePassword} disabled={isSaving} className="flex-1">
                                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                            Cambiar
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Logout Button */}
                <Button variant="destructive" onClick={handleLogout} className="w-full">
                    <LogOut className="h-4 w-4 mr-2" />
                    Cerrar Sesión
                </Button>
            </div>
        </div>
    );
}
