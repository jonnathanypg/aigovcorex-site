"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

export default function FichaSocioeconomicaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error en ficha socioeconómica:", error);
  }, [error]);

  return (
    <div className="space-y-4 max-w-xl mx-auto py-8">
      <Card className="border-destructive/40 bg-destructive/5 shadow-md">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Error al visualizar la Ficha Socioeconómica
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ocurrió un error inesperado al procesar los datos de la ficha socioeconómica.
            {error.message && (
              <span className="block mt-2 font-mono text-xs p-2 bg-destructive/10 rounded text-destructive">
                {error.message}
              </span>
            )}
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="default" size="sm" onClick={() => reset()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </Button>
            <Link href="/admision">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver a Admisión
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
