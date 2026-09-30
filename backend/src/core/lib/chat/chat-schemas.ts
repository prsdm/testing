import { z } from "zod";

export const chatHistoryMessageSchema = z.object({
  content: z.string().min(1),
  role: z.enum(["user", "assistant"]),
});

export type ChatHistoryMessage = z.infer<typeof chatHistoryMessageSchema>;
