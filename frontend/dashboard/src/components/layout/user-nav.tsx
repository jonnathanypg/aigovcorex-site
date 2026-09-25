"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AgentConfigModal } from "@/components/license-admin/AgentConfigModal";
import { MessagingChannelsModal } from "@/components/license-admin/MessagingChannelsModal";
import { OrganizationDialog } from "@/components/license-admin/OrganizationDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PlaceHolderImages } from "@/lib/placeholder-images"
import Image from "next/image"
import { UserProfileClient } from "./user-profile-client"
import { authService } from "@/services/auth.service"
import type { User } from "@/types"

export function UserNav() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAgentConfigOpen, setIsAgentConfigOpen] = useState(false);
  const [isChannelsModalOpen, setIsChannelsModalOpen] = useState(false);
  const [isOrgDialogOpen, setIsOrgDialogOpen] = useState(false);
  const userAvatar = PlaceHolderImages.find(p => p.id === 'user-avatar');

  useEffect(() => {
    const updateUser = () => setUser(authService.getStoredUser());
    updateUser();
    window.addEventListener('user-profile-updated', updateUser);
    return () => window.removeEventListener('user-profile-updated', updateUser);
  }, []);

  const handleLogout = () => {
    authService.logout();
    router.push('/login');
  };

  const currentRole = user?.role === 'admin' ? 'Administrador' :
    user?.role === 'coordinator' ? 'Coordinador' :
      user?.role === 'educator' ? 'Educadora' :
        user?.role === 'license_admin' ? 'License Admin' :
          user?.role === 'supervisor' ? 'Supervisor' : user?.role || 'Usuario';

  // Determine if user can see channels menu
  // Allowed: license_admin, center_coordinator, educadora (essentially everyone with dashboard access currently)
  // Restricted: 'padre' probably doesn't have this dashboard access anyway.
  const roleName = typeof user?.role === 'string' ? user.role : (user?.role as any)?.name || '';
  const canAccessChannels = ['license_admin', 'center_coordinator', 'educator', 'coordinator'].includes(roleName);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-9 w-9 overflow-hidden border border-white/10">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="User avatar" className="w-full h-full object-cover" />
              ) : userAvatar ? (
                <Image src={userAvatar.imageUrl} alt="User avatar" width={40} height={40} data-ai-hint={userAvatar.imageHint} />
              ) : (
                <AvatarFallback>{user?.first_name?.charAt(0) || 'U'}</AvatarFallback>
              )}
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-background/80 backdrop-blur-lg border-border/30" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user?.full_name || 'Usuario'}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user?.email || ''} - {currentRole}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <UserProfileClient>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                Perfil
              </DropdownMenuItem>
            </UserProfileClient>

            {user?.role === 'license_admin' && (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setIsAgentConfigOpen(true);
                }}
                className="cursor-pointer"
              >
                Personalizar Agente & Logos
              </DropdownMenuItem>
            )}

            {user?.role === 'license_admin' && (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setIsOrgDialogOpen(true);
                }}
                className="cursor-pointer"
              >
                Organización
              </DropdownMenuItem>
            )}

            {canAccessChannels && (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setIsChannelsModalOpen(true);
                }}
                className="cursor-pointer"
              >
                Canales de Mensajería
              </DropdownMenuItem>
            )}

          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
            Cerrar Sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Agent & Sponsor Config Modal */}
      {isAgentConfigOpen && (
        <AgentConfigModal
          isOpen={isAgentConfigOpen}
          onClose={() => setIsAgentConfigOpen(false)}
        />
      )}

      {/* Organization / Legal Info Modal */}
      <OrganizationDialog
        open={isOrgDialogOpen}
        onOpenChange={setIsOrgDialogOpen}
      />

      {/* Messaging Channels Modal */}
      <MessagingChannelsModal
        open={isChannelsModalOpen}
        onOpenChange={setIsChannelsModalOpen}
        userRole={typeof user?.role === 'string' ? user.role : (user?.role as any)?.name || ''}
      />
    </>
  )
}
