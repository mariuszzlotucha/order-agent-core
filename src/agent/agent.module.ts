import { Module } from '@nestjs/common';
import { BundleLoaderModule } from '../bundle-loader/bundle-loader.module';
import { HandoffService } from '../tools/handoff.service';
import { HttpOrdersClient, OrdersClient } from '../tools/orders.client';
import { AgentService } from './agent.service';

@Module({
  imports: [BundleLoaderModule],
  providers: [
    AgentService,
    HandoffService,
    // Do ewaluacji mozna podmienic na klienta z mock_orders
    { provide: OrdersClient, useClass: HttpOrdersClient },
  ],
  exports: [AgentService],
})
export class AgentModule {}
