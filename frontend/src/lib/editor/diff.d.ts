import type { Schema } from "prosemirror-model";

declare module "@/lib/editor/diff" {
  export const DiffType: {
    readonly Unchanged: 0;
    readonly Deleted: -1;
    readonly Inserted: 1;
  };

  export function diffEditor(
    schema: Schema,
    oldDoc: unknown,
    newDoc: unknown
  ): import("prosemirror-model").Node;
}
