import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import { RoleProvider } from '@/hooks/use-role';
import { ThemeProvider } from '@/components/theme-provider';
import { LicenseProvider } from '@/contexts/license-context';
import { ReactQueryProvider } from '@/components/providers/react-query-provider';
import { PrivacyBannerDashboard } from '@/components/auth/privacy-banner-dashboard';

export const metadata: Metadata = {
  title: {
    default: 'KindiCore AI — Sistema CDI',
    template: '%s | KindiCore AI',
  },
  description: 'Sistema Operativo Integral para la Gestión de Centros de Desarrollo Infantil. IA pedagógica, cumplimiento MIES, seguimiento IDII, salud y nutrición.',
  keywords: ['CDI', 'MIES', 'desarrollo infantil', 'Ecuador', 'gestión', 'IA pedagógica', 'IDII'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Inter Variable — premium typography */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={cn("font-sans antialiased", "min-h-screen bg-background")}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <RoleProvider>
            <LicenseProvider>
              <ReactQueryProvider>
                {children}
              </ReactQueryProvider>
            </LicenseProvider>
          </RoleProvider>
          <PrivacyBannerDashboard />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

