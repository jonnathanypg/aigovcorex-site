"use client"

import React, { useEffect, useState, useCallback } from "react"
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import { useRole } from "@/hooks/use-role"
import { monitoringService, type ChartDataPoint } from "@/services/monitoring.service"
import { useAgentRefresh } from "@/hooks/use-agent-refresh"
import { Loader2 } from "lucide-react"

/* Vibrant warm palette — works on both light and dark backgrounds */
const VIBRANT_COLORS = [
  "#f59e0b", // amber
  "#f97316", // orange
  "#14b8a6", // teal
  "#fbbf24", // yellow-amber
  "#fb7185", // rose
  "#34d399", // emerald
  "#059669", // emerald
  "#a3e635", // lime
];

export function DevelopmentChart({ className, tenantId }: { className?: string; tenantId?: number }) {
  const { role, center } = useRole();
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chartKeys, setChartKeys] = useState<string[]>([]);
  const [chartConfig, setChartConfig] = useState<ChartConfig>({});

  const fetchData = useCallback(async () => {
    try {
      const chartData = await monitoringService.getDevelopmentChart(tenantId);
      setData(chartData);

      if (chartData.length > 0) {
        const keys = Object.keys(chartData[0]).filter(k => k !== 'area');
        setChartKeys(keys);

        // Build config with explicit hex colors (avoids CSS variable resolution issues)
        const newConfig: ChartConfig = {};
        keys.forEach((key, index) => {
          newConfig[key] = {
            label: key,
            color: VIBRANT_COLORS[index % VIBRANT_COLORS.length],
          };
        });
        setChartConfig(newConfig);
      }
    } catch (error) {
      console.error("Error fetching chart data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useAgentRefresh(fetchData);

  // Safe description — handles null center for license_admin
  const description = role === 'license_admin'
    ? "Progreso promedio por dominio de desarrollo (Global)"
    : role === 'admin'
      ? "Progreso promedio por dominio de desarrollo"
      : `Progreso promedio (${center || "Mi Centro"})`;

  if (isLoading) {
    return (
      <Card className={cn("lg:col-span-3", className)}>
        <CardContent className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("lg:col-span-3", className)}>
      <CardHeader>
        <CardTitle>Desarrollo Comparativo</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
          <BarChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="area"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value}
            />
            <YAxis domain={[0, 100]} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {chartKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={VIBRANT_COLORS[index % VIBRANT_COLORS.length]}
                radius={6}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
