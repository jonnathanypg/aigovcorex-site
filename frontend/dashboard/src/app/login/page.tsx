"use client";

/**
 * AI GovCoreX OS — Login Page
 * Clean institutional login
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authService } from "@/services/auth.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    AlertCircle,
    Loader2,
    Eye,
    EyeOff,
    Shield,
} from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const response = await authService.login(email, password);

            if (response.user?.role === 'super_admin') {
                router.push("/super-admin");
            } else {
                router.push("/dashboard");
            }
        } catch (err: unknown) {
            const errorMessage =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                "Error al iniciar sesión. Verifique sus credenciales.";
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-zinc-950 p-4">
            {/* Subtle background */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-sky-500/05 blur-[130px]" />
                <div className="absolute -bottom-32 -right-32 h-[600px] w-[600px] rounded-full bg-amber-500/05 blur-[150px]" />
                
                {/* Subtle grid pattern */}
                <div
                    className="absolute inset-0 opacity-[0.02]"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                        backgroundSize: '48px 48px',
                    }}
                />
            </div>

            {/* Main container - centered card */}
            <div className="relative z-10 w-full max-w-md">
                <div className="bg-zinc-900/80 backdrop-blur-2xl border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
                    {/* Gradient top bar */}
                    <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 via-sky-500 to-amber-500" />

                    <div className="p-7 sm:p-8">
                        <div className="text-center mb-6">
                            <div className="inline-flex items-center justify-center p-2 rounded-xl bg-white/5 border border-white/10 mb-3">
                                <span className="text-xs font-bold text-amber-400 tracking-wider">AI GOVCOREX OS</span>
                            </div>
                            <h1 className="text-xl font-bold text-white tracking-tight">
                                Ingreso al Sistema Operativo
                            </h1>
                            <p className="text-xs text-zinc-400 mt-1">
                                Acceso institucional y gobernanza de programas sociales
                            </p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-red-500/30 bg-red-950/40 animate-fade-in-up">
                                    <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                                    <p className="text-xs text-red-300 leading-relaxed">{error}</p>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label htmlFor="email" className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">
                                    Correo Electrónico
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="usuario@institucion.gob.ec"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={isLoading}
                                    className="h-11 rounded-xl bg-zinc-950/70 border-zinc-800 text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all duration-200"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="password" className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">
                                    Contraseña
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        disabled={isLoading}
                                        className="h-11 rounded-xl bg-zinc-950/70 border-zinc-800 text-white pr-10 focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all duration-200"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-11 rounded-xl bg-gradient-to-r from-sky-500 via-amber-500 to-orange-500 hover:from-sky-600 hover:via-amber-600 hover:to-orange-600 text-white font-bold shadow-lg shadow-sky-500/20 hover:shadow-sky-500/30 transition-all duration-300 hover:scale-[1.01]"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Iniciando sesión...
                                    </>
                                ) : (
                                    <>
                                        <Shield className="mr-2 h-4 w-4" />
                                        Iniciar Sesión
                                    </>
                                )}
                            </Button>
                        </form>

                        <div className="flex items-center justify-center gap-4 text-xs text-zinc-500 mt-6">
                            <Link href="/privacy" className="hover:text-sky-400 transition-colors">
                                Privacidad
                            </Link>
                            <span>&bull;</span>
                            <Link href="/cookies" className="hover:text-sky-400 transition-colors">
                                Cookies
                            </Link>
                            <span>&bull;</span>
                            <Link href="/terms" className="hover:text-sky-400 transition-colors">
                                Términos
                            </Link>
                        </div>

                        <p className="text-center text-xs text-zinc-600 mt-3">
                            © {new Date().getFullYear()} AI GovCoreX OS · WeblifeTech · Todos los derechos reservados.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}