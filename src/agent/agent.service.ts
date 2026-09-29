import { Injectable, Logger } from '@nestjs/common';
import { ChatAnthropic } from '@langchain/anthropic';
import { MemorySaver } from '@langchain/langgraph';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { BundleLoaderService } from '../bundle-loader/bundle-loader.service';
import { Bundle } from '../bundle-loader/bundle.types';
import { HandoffService } from '../tools/handoff.service';
import { createHandoffTool } from '../tools/handoff.tool';
import { createOrderStatusTool } from '../tools/order-status.tool';
import { OrdersClient } from '../tools/orders.client';

const GENERIC_ERROR = 'Przepraszam, wystapil problem. Sprobuj ponownie za chwile.';
const TOO_LONG = 'Wiadomosc jest pusta lub zbyt dluga. Napisz krocej, prosze.';

interface CachedAgent {
  versionId: string;
  bundle: Bundle;
  agent: { invoke: (input: any, config: any) => Promise<any> };
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  // Dev: pamiec procesu. Produkcja: checkpointer Postgres/Redis z retencja (RODO).
  private readonly checkpointer = new MemorySaver();
  private cached?: CachedAgent;

  constructor(
    private readonly loader: BundleLoaderService,
    private readonly orders: OrdersClient,
    private readonly handoff: HandoffService,
  ) {}

  async handleMessage(phone: string, text: string): Promise<string> {
    const { versionId, bundle } = this.loader.current();
    const { limits, security } = bundle.manifest;

    if (!text.trim() || text.length > limits.max_message_length) return TOO_LONG;

    try {
      const { agent } = this.getAgent(versionId, bundle);
      const result = await agent.invoke(
        { messages: [{ role: 'user', content: text }] },
        {
          // phone trafia do narzedzi przez config, model go nie widzi ani nie ustawia
          configurable: { thread_id: phone, phone },
          recursionLimit: limits.max_agent_steps * 2 + 1,
        },
      );

      const reply = extractText(result.messages?.at(-1)?.content).trim();

      // Filtr wyjscia: wyciek canary
      if (reply.includes(security.canary)) {
        this.logger.error(`ALERT canary leak, bundle=${versionId}`);
        return GENERIC_ERROR;
      }
      return reply || GENERIC_ERROR;
    } catch (e) {
      // Nie logujemy e.message, bo moze zawierac fragmenty promptu
      this.logger.error(`Agent error, bundle=${versionId}, type=${e instanceof Error ? e.name : 'unknown'}`);
      return GENERIC_ERROR;
    }
  }

  private getAgent(versionId: string, bundle: Bundle): CachedAgent {
    if (this.cached?.versionId === versionId) return this.cached;

    const { manifest, prompts, tools } = bundle;
    if (manifest.model.provider !== 'anthropic') throw new Error('Unsupported provider');

    const llm = new ChatAnthropic({
      model: manifest.model.name,
      temperature: manifest.model.temperature,
      maxTokens: manifest.model.max_tokens,
    });

    const agent = createReactAgent({
      llm,
      tools: [
        createOrderStatusTool(tools.order_status, this.orders),
        createHandoffTool(tools.handoff_to_human, this.handoff),
      ],
      prompt: `${prompts.system}\n\n${prompts.fewshot}`,
      checkpointSaver: this.checkpointer,
    });

    this.cached = { versionId, bundle, agent: agent as unknown as CachedAgent['agent'] };
    this.logger.log(`Agent zbudowany, bundle=${versionId}, version=${manifest.version}`);
    return this.cached;
  }
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (typeof b === 'string' ? b : b?.type === 'text' ? b.text : ''))
      .join('');
  }
  return '';
}
