import { z } from 'zod';

export const bundleSchema = z.object({
  manifest: z.object({
    name: z.string(),
    version: z.string(),
    model: z.object({
      provider: z.string(),
      name: z.string(),
      temperature: z.number(),
      max_tokens: z.number(),
    }),
    limits: z.object({
      max_agent_steps: z.number().int().positive(),
      max_tool_calls_per_message: z.number().int().positive(),
      max_message_length: z.number().int().positive(),
    }),
    security: z.object({ canary: z.string().min(8) }),
  }),
  prompts: z.object({ system: z.string().min(1), fewshot: z.string() }),
  tools: z.object({ order_status: z.string().min(1), handoff_to_human: z.string().min(1) }),
});

export type Bundle = z.infer<typeof bundleSchema>;

export interface LoadedBundle {
  versionId: string;
  bundle: Bundle;
}
