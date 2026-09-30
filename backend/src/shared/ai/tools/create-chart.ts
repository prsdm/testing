import { tool } from "ai";
import { z } from "zod";

export const CHART_TYPES = ["bar", "line", "pie", "doughnut"] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export const MAX_CHART_LABELS = 50;
export const MAX_CHART_DATASETS = 8;

const chartDatasetSchema = z.object({
  data: z.array(z.number().finite()).min(1).max(MAX_CHART_LABELS),
  label: z.string().min(1).max(80),
});

export const createChartInputSchema = z.object({
  chartType: z.enum(CHART_TYPES),
  datasets: z.array(chartDatasetSchema).min(1).max(MAX_CHART_DATASETS),
  labels: z.array(z.string().min(1).max(80)).min(1).max(MAX_CHART_LABELS),
  title: z.string().min(1).max(120),
});

export type CreateChartToolInput = z.infer<typeof createChartInputSchema>;

export type CreateChartToolOutput = {
  title: string;
  chartType: ChartType;
  labels: string[];
  datasets: Array<{ label: string; data: number[] }>;
};

export function normalizeCreateChartInput(
  input: CreateChartToolInput
): CreateChartToolOutput | { error: string } {
  const labelCount = input.labels.length;
  for (const dataset of input.datasets) {
    if (dataset.data.length !== labelCount) {
      return {
        error: `Dataset "${dataset.label}" has ${dataset.data.length} values but there are ${labelCount} labels.`,
      };
    }
  }

  return {
    chartType: input.chartType,
    datasets: input.datasets.map((dataset) => ({
      data: dataset.data,
      label: dataset.label.trim(),
    })),
    labels: input.labels.map((label) => label.trim()),
    title: input.title.trim(),
  };
}

function toCreateChartModelText(output: CreateChartToolOutput) {
  const series = output.datasets
    .map((dataset) => `${dataset.label} (${dataset.data.length} points)`)
    .join(", ");
  return `Chart created: "${output.title}" (${output.chartType}) with labels [${output.labels.join(", ")}] and series ${series}. The chart is shown to the user in the chat UI.`;
}

export const createChart = () =>
  tool({
    description:
      "Create an interactive chart (bar, line, pie, or doughnut) from numeric data. Use when the user asks to chart, plot, visualize, or graph numbers. Prefer this over ASCII tables for trends and comparisons.",
    // biome-ignore lint/suspicious/useAwait: preserves async tool execution semantics
    execute: async (input) => {
      const normalized = normalizeCreateChartInput(input);
      if ("error" in normalized) {
        return {
          contextForLlm: normalized.error,
          error: normalized.error,
        };
      }
      return {
        ...normalized,
        contextForLlm: toCreateChartModelText(normalized),
      };
    },
    inputSchema: createChartInputSchema,
  });
