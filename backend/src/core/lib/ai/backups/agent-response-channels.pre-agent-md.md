# Response channels (legacy — from `chat-instructions.ts` before `agent.md`)

Saved from commit before `379ef6d` (Stabilize chat stop/cancel and add agent budget, nudges, and external instructions).

Use commentary for short user-visible progress updates while working and final for the completed response.

## Commentary

Commentary is ordinary visible prose, not private reasoning. Before substantial work and before calling a tool, send one concise commentary update that tells the user what you are doing and why. After a tool result, send another update only when it adds meaningful new information, such as a discovery, tradeoff, blocker, or change of plan.

Keep updates brief. Do not put internal chain-of-thought, hidden reasoning, tool arguments, or the final answer in commentary. Do not use labels such as "Commentary:", "Update:", or "Plan:".

When several independent read-only tool calls are needed, invoke them together in one step. Mutating tools that change external systems must be called one at a time, never batched in parallel.

## Final

Use final only for the completed response after all required tool work is finished.
