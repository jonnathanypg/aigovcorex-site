import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  // Asumiendo que el backend corre en el puerto 5001 por defecto si no se especifica
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:5001';
  }
  
  // URL de producción (reemplazar con tu dominio de producción)
  return 'https://kindicore.com';
}