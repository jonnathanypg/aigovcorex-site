"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

// Schema for AI-Powered Data Analysis
const analysisSchema = z.object({
  question: z.string().min(10, { message: "La pregunta debe tener al menos 10 caracteres." }),
});

export type AnalysisState = {
  answer?: string;
  visualization?: string;
  errors?: {
    question?: string[];
  };
  message?: string | null;
};

export async function handleAnalysisQuery(
  prevState: AnalysisState,
  formData: FormData
): Promise<AnalysisState> {
  // STUBBED: Backend logic removed as per user request to keep frontend pure.
  // Implementation should be moved to Python backend (kindicore-py).

  const validatedFields = analysisSchema.safeParse({
    question: formData.get("question"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Error de validación. Por favor, revise la pregunta.",
    };
  }

  // Simulate delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  return {
    message: "La funcionalidad de análisis se está migrando al backend central. Por favor reintente más tarde.",
    answer: "Servicio de Análisis migrando a Python Backend...",
  };
}

// Schema for Intelligent Data Ingestion
const ingestionSchema = z.object({
  photoDataUri: z.string().min(1, { message: "Por favor, seleccione una imagen." }),
});

export type IngestionState = {
  extractedText?: string;
  signatureDetected?: boolean;
  errors?: {
    photoDataUri?: string[];
  };
  message?: string | null;
}

export async function handleIngestion(
  prevState: IngestionState,
  formData: FormData
): Promise<IngestionState> {
  // STUBBED: Backend logic removed.
  const validatedFields = ingestionSchema.safeParse({
    photoDataUri: formData.get("photoDataUri"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Error de validación. Asegúrese de subir una imagen.",
    };
  }

  // Simulate delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  return {
    message: "La funcionalidad de ingesta se está migrando al backend central.",
    extractedText: "Servicio de Ingesta migrando a Python Backend...",
    signatureDetected: false
  };
}
