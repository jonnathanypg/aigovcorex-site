import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      backgroundImage: {
        // Animated mesh gradient — warm amber/orange radials
        'mesh-gradient':
          "radial-gradient(ellipse 80% 60% at 10% 5%, hsl(38 95% 50% / 0.12), transparent 55%), radial-gradient(ellipse 70% 70% at 90% 95%, hsl(16 85% 58% / 0.10), transparent 55%), radial-gradient(ellipse 60% 80% at 50% 50%, hsl(38 95% 50% / 0.04), transparent 70%)",
        // Glassmorphism card gradient
        'glass-gradient':
          'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
        // Hero gradient
        'hero-gradient':
          'linear-gradient(135deg, hsl(38 95% 50%), hsl(16 85% 58%), hsl(38 95% 65%))',
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
        headline: ['"Inter"', 'system-ui', 'sans-serif'],
        code: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        // Brand corporate identity colors (Silicon Valley style)
        brand: {
          sapphire: '#1e40af',
          teal: '#0d9488',
          slate: '#1e293b',
          light: '#f8fafc',
        },
        // KindiCore brand extended palette
        kindicore: {
          amber: {
            50: '#fffbeb',
            100: '#fef3c7',
            200: '#fde68a',
            300: '#fcd34d',
            400: '#fbbf24',
            500: '#f59e0b',
            600: '#d97706',
            700: '#b45309',
            800: '#92400e',
            900: '#78350f',
          },
          orange: {
            400: '#fb923c',
            500: '#f97316',
            600: '#ea580c',
          },
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
      },
      boxShadow: {
        // Glassmorphism shadows
        'glass-sm': '0 4px 16px rgba(251, 146, 60, 0.08), 0 1px 4px rgba(0,0,0,0.04)',
        'glass-md': '0 8px 32px rgba(251, 146, 60, 0.12), 0 2px 8px rgba(0,0,0,0.06)',
        'glass-lg': '0 16px 48px rgba(251, 146, 60, 0.15), 0 4px 16px rgba(0,0,0,0.08)',
        'glow-amber': '0 0 20px rgba(251, 146, 60, 0.30), 0 0 40px rgba(251, 146, 60, 0.12)',
        'glow-amber-sm': '0 0 10px rgba(251, 146, 60, 0.20)',
        'premium': '0 20px 60px -15px rgba(0,0,0,0.15), 0 6px 20px -8px rgba(251, 146, 60, 0.10)',
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'mesh-gradient-animation': {
          '0%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
          '100%': { 'background-position': '0% 50%' },
        },
        // Onboarding & UI animations
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-from-bottom-4': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-0': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-bounce': {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '70%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '33%': { transform: 'translateY(-8px) rotate(1deg)' },
          '66%': { transform: 'translateY(-4px) rotate(-1deg)' },
        },
        'pulse-glow-amber': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(251, 146, 60, 0.15)' },
          '50%': { boxShadow: '0 0 24px rgba(251, 146, 60, 0.35), 0 0 48px rgba(251, 146, 60, 0.10)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'spinner': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'toast-slide-in': {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'mesh-gradient': 'mesh-gradient-animation 25s ease infinite',
        'fade-in-up': 'fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-from-bottom-4': 'slide-in-from-bottom-4 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in-0': 'fade-in-0 0.3s ease both',
        'scale-bounce': 'scale-bounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow-amber': 'pulse-glow-amber 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'spinner': 'spinner 0.8s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;

export default config;
