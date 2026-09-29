import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { AgentController } from './agent.controller';
import { ServiceTokenGuard } from './service-token.guard';

@Module({
  imports: [AgentModule],
  controllers: [AgentController],
  providers: [ServiceTokenGuard],
})
export class ApiModule {}
