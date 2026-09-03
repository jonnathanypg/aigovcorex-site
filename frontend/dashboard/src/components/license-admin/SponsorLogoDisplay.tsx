'use client';

import { useQuery } from '@tanstack/react-query';
import { licenseAdminService, SponsorLogo } from '@/services/license-admin.service';

interface SponsorLogoDisplayProps {
  usePublicEndpoint?: boolean;
}

export function SponsorLogoDisplay({ usePublicEndpoint = false }: SponsorLogoDisplayProps) {
  const { data: sponsorLogos, isLoading } = useQuery<SponsorLogo[]>({
    queryKey: ['sponsorLogos', usePublicEndpoint ? 'public' : 'admin'],
    queryFn: async () => {
      try {
        if (usePublicEndpoint) {
          const config = await licenseAdminService.getPublicConfig();
          return config?.sponsor_logos || [];
        }
        return await licenseAdminService.getSponsorLogos();
      } catch (err) {
        return [];
      }
    },
    retry: false,
  });

  // Base URL helper
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const getImageUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${API_URL}${path}`;
  };

  if (isLoading) {
    // Skeleton minimalista
    return <div className="h-16 w-full animate-pulse bg-transparent" />;
  }

  // Si no hay logos o hay error, no mostrar nada (invisible)
  if (!sponsorLogos || sponsorLogos.length === 0) {
    return null;
  }

  return (
    <div className="w-full flex flex-wrap items-center justify-center gap-8 py-2 mb-6">
      {sponsorLogos.map((logo) => (
        <img
          key={logo.id}
          src={getImageUrl(logo.logo_path)}
          alt={`Patrocinador ${logo.id}`}
          className="h-16 w-auto object-contain"
        />
      ))}
    </div>
  );
}