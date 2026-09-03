
"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRole } from "@/hooks/use-role";
import { User, Shield } from 'lucide-react';

export function RoleSwitcher() {
  const { role, center, setRole, setCenter } = useRole();

  const handleRoleChange = (value: string) => {
    if (value === 'admin') {
      setRole('admin');
      setCenter(null);
    } else {
      setRole('coordinator');
      setCenter(value);
    }
  };

  const selectedValue = role === 'admin' ? 'admin' : center;

  return (
    <div className="flex items-center gap-2 max-w-xs">
        {role === 'admin' ? <Shield className="h-5 w-5 text-primary" /> : <User className="h-5 w-5 text-primary" />}
        <Select onValueChange={handleRoleChange} value={selectedValue || 'admin'}>
        <SelectTrigger className="w-auto border-0 bg-transparent shadow-none focus:ring-0">
            <SelectValue placeholder="Seleccionar Rol" />
        </SelectTrigger>
        <SelectContent className="bg-background/80 backdrop-blur-lg border-border/30">
            <SelectItem value="admin">Admin Master (Todos los centros)</SelectItem>
            <SelectItem value="Centro Bahía">Coordinador (Centro Bahía)</SelectItem>
            <SelectItem value="Centro Guasmo">Coordinador (Centro Guasmo)</SelectItem>
        </SelectContent>
        </Select>
    </div>
  );
}