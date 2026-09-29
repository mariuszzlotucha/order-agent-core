import { BadRequestException, Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AgentService } from '../agent/agent.service';
import { ServiceTokenGuard } from './service-token.guard';

const messageSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{6,15}$/),
  text: z.string().min(1).max(4000),
});

// Kontrakt: handleMessage(phone, text) -> { reply }
@Controller()
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Post('agent/message')
  @HttpCode(200)
  @UseGuards(ServiceTokenGuard)
  async message(@Body() body: unknown): Promise<{ reply: string }> {
    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Invalid request');
    const reply = await this.agent.handleMessage(parsed.data.phone, parsed.data.text);
    return { reply };
  }

  // Bez zadnych informacji o bundlu
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
