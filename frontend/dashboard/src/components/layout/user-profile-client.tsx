"use client"

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "../ui/avatar"
import Image from "next/image"
import { PlaceHolderImages } from "@/lib/placeholder-images"
import { Label } from "../ui/label"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { Separator } from "../ui/separator"
import { Loader2, Lock, User } from "lucide-react"
import api from "@/services/api"
import { toast } from "sonner"

interface UserProfile {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
}

export function UserProfileClient({ children }: { children: React.ReactNode }) {
  const defaultPlaceholder = PlaceHolderImages.find(p => p.id === 'user-avatar');

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  // Profile data
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<string>("");
  const [center, setCenter] = useState<string>("");

  // Editable fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");

  // Password fields
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadProfile();
    }
  }, [isOpen]);

  const loadProfile = async () => {
    try {
      setIsFetching(true);
      const { data } = await api.get<{ user: UserProfile; role: string; center: string }>('/api/users/profile');
      setProfile(data.user);
      setRole(data.role || "");
      setCenter(data.center || "");
      setFirstName(data.user.first_name);
      setLastName(data.user.last_name);
      setPhone(data.user.phone || "");
      setAvatarUrl(data.user.avatar_url || "");
    } catch (error) {
      console.error("Error loading profile:", error);
      toast.error("Error al cargar el perfil");
    } finally {
      setIsFetching(false);
    }
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("La imagen debe ser menor a 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      setAvatarUrl(base64);
      toast.success("Foto seleccionada. Recuerda guardar cambios para aplicarla.");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate passwords match if trying to change
    if (newPassword && newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setIsLoading(true);
    try {
      const updateData: any = {
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        avatar_url: avatarUrl
      };

      if (newPassword) {
        updateData.new_password = newPassword;
        updateData.confirm_password = confirmPassword;
      }

      const res = await api.put('/api/users/profile', updateData);
      
      // Update local storage user if exists
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('user');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            parsed.avatar_url = avatarUrl;
            parsed.first_name = firstName;
            parsed.last_name = lastName;
            localStorage.setItem('user', JSON.stringify(parsed));
            window.dispatchEvent(new Event('user-profile-updated'));
          } catch (e) {}
        }
      }

      toast.success("Perfil actualizado correctamente");
      setNewPassword("");
      setConfirmPassword("");
      setIsOpen(false);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error(error.response?.data?.error || "Error al actualizar el perfil");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-background/95 backdrop-blur-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Perfil de Usuario
          </DialogTitle>
          <DialogDescription>
            Vea y actualice la información de su perfil.
          </DialogDescription>
        </DialogHeader>

        {isFetching ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Avatar className="h-16 w-16 border-2 border-primary/20 overflow-hidden">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="User avatar" className="w-full h-full object-cover" />
                  ) : defaultPlaceholder ? (
                    <Image src={defaultPlaceholder.imageUrl} alt="User avatar" width={64} height={64} data-ai-hint={defaultPlaceholder.imageHint} />
                  ) : (
                    <AvatarFallback>{firstName?.[0]}{lastName?.[0]}</AvatarFallback>
                  )}
                </Avatar>
                <label 
                  htmlFor="avatarUploadInput" 
                  className="absolute inset-0 bg-black/50 text-white rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[10px] font-medium"
                >
                  Cambiar
                </label>
                <input
                  id="avatarUploadInput"
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={handleAvatarFile}
                />
              </div>
              <div>
                <p className="font-medium">{profile?.email}</p>
                <p className="text-sm text-muted-foreground">{role} {center ? `- ${center}` : ''}</p>
                <label 
                  htmlFor="avatarUploadInput" 
                  className="text-xs text-primary hover:underline cursor-pointer block mt-1"
                >
                  Subir o cambiar foto de perfil
                </label>
              </div>
            </div>

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
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+593 999 999 999"
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Cambiar Contraseña</span>
                <span className="text-xs text-muted-foreground">(opcional)</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nueva Contraseña</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>
              {newPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">Las contraseñas no coinciden</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading || (newPassword !== "" && newPassword !== confirmPassword)}>
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
                ) : (
                  "Guardar Cambios"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}