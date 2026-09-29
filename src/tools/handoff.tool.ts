import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { HandoffService } from './handoff.service';

export function createHandoffTool(description: string, handoff: HandoffService) {
  return tool(
    async ({ summary }, config) => {
      const phone = config?.configurable?.phone as string | undefined;
      await handoff.request(phone, summary);
      return 'Rozmowa zostala przekazana do konsultanta.';
    },
    {
      name: 'handoff_to_human',
      description, // z bundla (secret manager)
      schema: z.object({
        summary: z.string().min(1).max(500),
      }),
    },
  );
}
