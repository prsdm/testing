import { customType } from "drizzle-orm/pg-core";
import { EMBEDDING_DIMENSION } from "@/core/lib/search/constants";

export function formatPgVector(values: number[]): string {
  return `[${values.join(",")}]`;
}

export const pgVector768 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return `vector(${EMBEDDING_DIMENSION})`;
  },
  fromDriver(value: string) {
    const trimmed = value.trim();
    if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
      return [];
    }
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) {
      return [];
    }
    return inner.split(",").map((part) => Number.parseFloat(part.trim()));
  },
  toDriver(value: number[]) {
    return formatPgVector(value);
  },
});
