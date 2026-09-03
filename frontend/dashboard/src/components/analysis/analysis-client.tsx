
"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { handleAnalysisQuery, type AnalysisState } from "@/lib/actions";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Terminal, Bot, BarChart2 } from "lucide-react";
import { DevelopmentChart } from "../dashboard/development-chart";

const initialState: AnalysisState = {
  message: null,
  errors: {},
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Analizando..." : "Preguntar al Analista"}
    </Button>
  );
}

export function AnalysisClient() {
  const [state, formAction] = useFormState(handleAnalysisQuery, initialState);

  return (
    <div className="grid gap-6">
      <form action={formAction}>
        <Card>
          <CardHeader>
            <CardTitle>Nueva Consulta</CardTitle>
            <CardDescription>
              Escriba su pregunta en el siguiente campo. Por ejemplo: &quot;¿Puedes mostrarme un desarrollo comparativo del desempeño de los centros?&quot;
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              name="question"
              placeholder="Su pregunta aquí..."
              className="min-h-[100px]"
              required
            />
            {state?.errors?.question && (
              <p className="text-sm font-medium text-destructive mt-2">
                {state.errors.question[0]}
              </p>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <div>
            {state?.message && !state?.errors?.question && (
                 <p className={`text-sm ${state.answer ? 'text-green-600' : 'text-destructive'}`}>
                    {state.message}
                 </p>
            )}
            </div>
            <SubmitButton />
          </CardFooter>
        </Card>
      </form>
      
      {state.answer && (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bot size={20}/> Respuesta del Analista</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <Alert>
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Respuesta</AlertTitle>
                    <AlertDescription>
                        {state.answer}
                    </AlertDescription>
                </Alert>

                {state.visualization === 'bar_chart' && (
                    <Alert>
                        <BarChart2 className="h-4 w-4" />
                        <AlertTitle>Visualización</AlertTitle>
                        <AlertDescription>
                           <div className="h-[250px] w-full mt-4">
                             <DevelopmentChart />
                           </div>
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
      )}
    </div>
  );
}
