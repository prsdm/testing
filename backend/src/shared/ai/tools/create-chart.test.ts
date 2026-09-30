import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createChartInputSchema,
  normalizeCreateChartInput,
} from "./create-chart";

describe("normalizeCreateChartInput", () => {
  it("accepts aligned bar chart data", () => {
    const parsed = createChartInputSchema.parse({
      chartType: "bar",
      datasets: [{ data: [10, 20], label: "2025" }],
      labels: ["Q1", "Q2"],
      title: "Revenue",
    });
    const result = normalizeCreateChartInput(parsed);
    assert.ok(!("error" in result));
    assert.equal(result.title, "Revenue");
    assert.equal(result.chartType, "bar");
  });

  it("rejects mismatched dataset lengths", () => {
    const parsed = createChartInputSchema.parse({
      chartType: "line",
      datasets: [{ data: [1], label: "Series" }],
      labels: ["A", "B"],
      title: "Bad",
    });
    const result = normalizeCreateChartInput(parsed);
    assert.ok("error" in result);
    assert.match(result.error, /labels/);
  });
});
