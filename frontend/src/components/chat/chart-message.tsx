"use client";

import {
  ArcElement,
  BarElement,
  CategoryScale,
  type Chart,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { DownloadIcon } from "lucide-react";
import { useId, useMemo, useRef } from "react";
import { Bar, Doughnut, Line, Pie } from "react-chartjs-2";
import { Button } from "@/components/ui/button";
import type { CreateChartToolOutput } from "@/shared/ai/tools/create-chart";
import { cn } from "@/shared/utils";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend
);

/** Chart.js docs sample palette (Utils.CHART_COLORS). */
const CHART_COLORS = [
  "#36a2eb", // blue
  "#ff6384", // red
  "#4bc0c0", // green/teal
  "#ff9f40", // orange
  "#9966ff", // purple
  "#ffcd56", // yellow
  "#c9cbcf", // grey
];

function chartFilename(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${slug || "chart"}.png`;
}

export function ChartMessage({
  chart,
  className,
}: {
  chart: CreateChartToolOutput;
  className?: string;
}) {
  const titleId = useId();
  const chartRef = useRef<Chart | null>(null);

  const data = useMemo(() => {
    const isArc = chart.chartType === "pie" || chart.chartType === "doughnut";
    const colorPerCategory =
      isArc || (chart.chartType === "bar" && chart.datasets.length === 1);

    return {
      datasets: chart.datasets.map((dataset, index) => {
        if (colorPerCategory) {
          return {
            backgroundColor: chart.labels.map(
              (_, labelIndex) =>
                CHART_COLORS[labelIndex % CHART_COLORS.length] ??
                CHART_COLORS[0]
            ),
            borderWidth: 0,
            data: dataset.data,
            label: dataset.label,
          };
        }
        const color =
          CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0];
        return {
          backgroundColor: color,
          borderColor: color,
          borderWidth: chart.chartType === "line" ? 2 : 0,
          data: dataset.data,
          fill: false,
          label: dataset.label,
          tension: 0.25,
        };
      }),
      labels: chart.labels,
    };
  }, [chart]);

  const options = useMemo(
    () => ({
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display:
            chart.datasets.length > 1 ||
            chart.chartType === "pie" ||
            chart.chartType === "doughnut",
          labels: {
            boxHeight: 12,
            boxWidth: 12,
            color: "#666",
          },
          position: "bottom" as const,
        },
        tooltip: {
          enabled: true,
        },
      },
      responsive: true,
      scales:
        chart.chartType === "pie" || chart.chartType === "doughnut"
          ? undefined
          : {
              x: {
                grid: { display: false },
                ticks: { color: "#666" },
              },
              y: {
                beginAtZero: true,
                grid: { color: "rgba(0,0,0,0.06)" },
                ticks: { color: "#666" },
              },
            },
    }),
    [chart.chartType, chart.datasets.length]
  );

  function onDownload() {
    const chartInstance = chartRef.current;
    if (!chartInstance) {
      return;
    }
    const url = chartInstance.toBase64Image("image/png", 1);
    const link = document.createElement("a");
    link.href = url;
    link.download = chartFilename(chart.title);
    link.click();
  }

  const commonProps = {
    data,
    options,
    // react-chartjs-2 ref typing differs by chart type; cast once.
    ref: chartRef as never,
  };

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "w-full max-w-xl rounded-xl border border-border/60 bg-background p-3",
        className
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="font-medium text-sm" id={titleId}>
          {chart.title}
        </h3>
        <Button
          aria-label={`Download ${chart.title} as PNG`}
          className="shrink-0"
          onClick={onDownload}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <DownloadIcon className="size-4" />
        </Button>
      </div>
      <div className="h-[280px] w-full">
        {chart.chartType === "bar" ? <Bar {...commonProps} /> : null}
        {chart.chartType === "line" ? <Line {...commonProps} /> : null}
        {chart.chartType === "pie" ? <Pie {...commonProps} /> : null}
        {chart.chartType === "doughnut" ? <Doughnut {...commonProps} /> : null}
      </div>
    </section>
  );
}
