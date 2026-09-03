
"use client";

import { useState, useCallback } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { handleIngestion, type IngestionState } from "@/lib/actions";
import Image from "next/image";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { FileText, CheckCircle, XCircle, UploadCloud, Loader2 } from "lucide-react";

const initialState: IngestionState = {
  message: null,
  errors: {},
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
       {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
      {pending ? "Procesando..." : "Extraer Datos del Formulario"}
    </Button>
  );
}

export function IngestionClient() {
  const [state, formAction] = useFormState(handleIngestion, initialState);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (file: File | null) => {
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
        setPreview(null);
        setFileName(null);
    }
  };
  
  const onDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileChange(file);
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const fileInput = document.getElementById('photo') as HTMLInputElement;
      fileInput.files = dataTransfer.files;
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFileChange(e.target.files?.[0] || null);
  }

  return (
    <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2">
      <form action={formAction}>
        <Card className="flex flex-col h-full">
          <CardHeader>
            <CardTitle>Cargar Ficha de Visita</CardTitle>
            <CardDescription>
              Arrastre y suelte la foto del formulario o haga clic para seleccionarla.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col space-y-4">
              <label 
                htmlFor="photo" 
                className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-muted/50'}`}
                onDragEnter={onDragEnter}
                onDragOver={onDragEnter}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                {preview ? (
                    <>
                        <Image src={preview} alt="Vista previa del formulario" layout="fill" objectFit="contain" className="rounded-md p-2" />
                        <div className="absolute bottom-2 right-2 bg-background/80 px-2 py-1 rounded-md text-xs backdrop-blur-sm">{fileName}</div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                        <UploadCloud className="w-10 h-10 mb-4 text-muted-foreground" />
                        <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold text-primary">Haga clic para subir</span> o arrastre y suelte</p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, o WEBP (MAX. 5MB)</p>
                    </div>
                )}
              </label>
              <input id="photo" name="photo" type="file" className="hidden" accept="image/*" required onChange={onFileChange} />
              <input type="hidden" name="photoDataUri" value={preview || ""} />
             
             {state?.errors?.photoDataUri && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                 {state.errors.photoDataUri[0]}
                </AlertDescription>
              </Alert>
            )}

            {state?.message && !state.extractedText && !state?.errors && (
                <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Error de Procesamiento</AlertTitle>
                    <AlertDescription>{state.message}</AlertDescription>
                </Alert>
            )}

          </CardContent>
          <CardFooter>
            <SubmitButton />
          </CardFooter>
        </Card>
      </form>
      
      <Card className={`transition-opacity duration-500 ${state.extractedText ? 'opacity-100' : 'opacity-50'}`}>
          <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText size={20}/> Datos Extraídos</CardTitle>
              <CardDescription>Resultados del análisis de la imagen del formulario.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {state.extractedText ? (
              <>
                <div className="space-y-2">
                  <h3 className="font-semibold text-primary">Verificación de Firma</h3>
                    {state.signatureDetected ? (
                        <Alert variant="default" className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                           <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                           <AlertTitle className="text-green-800 dark:text-green-300">Firma Detectada</AlertTitle>
                           <AlertDescription className="text-green-700 dark:text-green-400">
                               Se ha encontrado una firma válida en el documento.
                           </AlertDescription>
                        </Alert>
                    ) : (
                        <Alert variant="destructive">
                           <XCircle className="h-4 w-4" />
                           <AlertTitle>Firma No Detectada</AlertTitle>
                           <AlertDescription>
                               No se ha podido encontrar una firma en el documento. El campo puede estar vacío o no ser legible.
                           </AlertDescription>
                        </Alert>
                    )}
                </div>

                <div className="space-y-2">
                    <h3 className="font-semibold text-primary">Texto Reconocido del Formulario</h3>
                    <div className="p-4 bg-muted rounded-md text-sm whitespace-pre-wrap font-body border max-h-96 overflow-y-auto">
                      {state.extractedText}
                    </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-full min-h-[300px] bg-muted/50 rounded-lg border border-dashed">
                  <FileText className="w-16 h-16 mb-4" />
                  <p className="text-lg font-medium">Los datos extraídos aparecerán aquí.</p>
                  <p className="text-sm">Suba una imagen para comenzar el proceso.</p>
              </div>
            )}
          </CardContent>
      </Card>
    </div>
  );
}
