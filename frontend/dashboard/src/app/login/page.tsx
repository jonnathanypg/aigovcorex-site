"use client";

/**
 * AI GovCoreX OS — Login Page v3.0
 * Multi-Actor Governance & Autonomous Agentic Compliance OS
 * Dark Glassmorphism, Video Game Console HUD & HubSpot Multi-Tier aesthetic.
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
    Globe,
    Building2,
    HeartHandshake,
    Sparkles,
    CheckCircle2,
    Map,
    MessageSquare,
    Layers
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

    const quickSelectUser = (demoEmail: string) => {
        setEmail(demoEmail);
        setPassword("GovCoreX2026!");
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-zinc-950 p-4">
            {/* Background HUD decorative lights & grid */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-sky-500/10 blur-[130px]" />
                <div className="absolute -bottom-32 -right-32 h-[600px] w-[600px] rounded-full bg-amber-500/10 blur-[150px]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[450px] rounded-full bg-emerald-500/08 blur-[120px]" />
                
                {/* HUD Scanline & Grid pattern */}
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)',
                        backgroundSize: '32px 32px',
                    }}
                />
            </div>

            {/* Main container */}
            <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                
                {/* Left Column: Multi-Actor Information & Quick Demo Selection */}
                <div className="lg:col-span-5 hidden lg:flex flex-col gap-4 text-white p-2">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/25 border border-amber-400/30">
                            <span className="text-white font-black text-sm tracking-wider">GX</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-black tracking-tight leading-tight">AI GovCoreX OS</h2>
                            <p className="text-[11px] text-zinc-400 font-medium">Autonomous Compliance & Social Programs</p>
                        </div>
                    </div>

                    <p className="text-xs text-zinc-300/80 leading-relaxed mt-2">
                        Sistema Operativo multinivel para la gestión y fiscalización de programas sociales conectando al 100% de los actores institucionales.
                    </p>

                    {/* Multi-Actor Quick Select */}
                    <div className="mt-2 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                            Cuentas Demo Pre-configuradas (1-Click)
                        </p>

                        {[
                            { label: "1. Multilateral (BID)", email: "demo.multilateral@govcorex.org", role: "Auditor / Funder", color: "text-violet-400 border-violet-500/30 bg-violet-500/10", icon: Globe },
                            { label: "2. Gobierno / Ministerio (MIES)", email: "demo.gobierno@govcorex.org", role: "License Admin", color: "text-sky-400 border-sky-500/30 bg-sky-500/10", icon: Building2 },
                            { label: "3. GAD / Municipio (Guayaquil)", email: "demo.gad@govcorex.org", role: "Supervisor", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", icon: Shield },
                            { label: "4. ONG Ejecutora (Vida)", email: "demo.ong@govcorex.org", role: "Coordinador", color: "text-orange-400 border-orange-500/30 bg-orange-500/10", icon: HeartHandshake },
                            { label: "5. Educadora / Campo", email: "demo.educadora@govcorex.org", role: "Educadora CDI", color: "text-amber-400 border-amber-500/30 bg-amber-500/10", icon: Sparkles },
                        ].map((acc) => (
                            <button
                                key={acc.email}
                                type="button"
                                onClick={() => quickSelectUser(acc.email)}
                                className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all duration-200 hover:scale-[1.02] cursor-pointer ${acc.color}`}
                            >
                                <div className="flex items-center gap-2">
                                    <acc.icon className="w-3.5 h-3.5" />
                                    <div>
                                        <p className="text-xs font-bold text-white">{acc.label}</p>
                                        <p className="text-[10px] text-zinc-400 truncate">{acc.email}</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-black/40 text-zinc-300">
                                    {acc.role}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3 pt-2 text-zinc-500 text-[11px]">
                        <span className="flex items-center gap-1"><Map className="w-3 h-3 text-emerald-400" /> GeoMap OS</span>
                        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3 text-violet-400" /> WhatsApp RAG</span>
                        <span className="flex items-center gap-1"><Layers className="w-3 h-3 text-sky-400" /> KindiCore AI</span>
                    </div>
                </div>

                {/* Right Column: Main Login Card */}
                <div className="lg:col-span-7 w-full">
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
                                        placeholder="demo.gobierno@govcorex.org"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        disabled={isLoading}
                                        className="h-11 rounded-xl bg-zinc-950/70 border-zinc-800 text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all duration-200"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="password" className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">
                                            Contraseña
                                        </Label>
                                        <span className="text-[10px] text-zinc-500 font-mono">Demo: GovCoreX2026!</span>
                                    </div>
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
                                            Iniciando sesión en GovCoreX OS...
                                        </>
                                    ) : (
                                        <>
                                            <Shield className="mr-2 h-4 w-4" />
                                            Iniciar Sesión
                                        </>
                                    )}
                                </Button>
                            </form>

                            {/* Mobile Quick select toggle */}
                            <div className="lg:hidden mt-6 pt-4 border-t border-zinc-800 text-center">
                                <p className="text-[11px] text-zinc-400 mb-2">Seleccionar cuenta demo rápida:</p>
                                <div className="flex flex-wrap gap-1.5 justify-center">
                                    <button onClick={() => quickSelectUser("demo.gobierno@govcorex.org")} className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/30 px-2.5 py-1 rounded-lg">Gobierno</button>
                                    <button onClick={() => quickSelectUser("demo.multilateral@govcorex.org")} className="text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/30 px-2.5 py-1 rounded-lg">Multilateral</button>
                                    <button onClick={() => quickSelectUser("demo.ong@govcorex.org")} className="text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/30 px-2.5 py-1 rounded-lg">ONG</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-4 text-xs text-zinc-500 mt-4">
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

                    <p className="text-center text-xs text-zinc-600 mt-2">
                        © {new Date().getFullYear()} AI GovCoreX OS · WeblifeTech · Todos los derechos reservados.
                    </p>
                </div>
            </div>
        </div>
    );
}
