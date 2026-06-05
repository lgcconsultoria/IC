import { Module } from '@nestjs/common';
import { WearablesController } from './wearables.controller';
import { TerraWebhookService } from './terra-webhook.service';

@Module({
  controllers: [WearablesController],
  providers: [TerraWebhookService],
})
export class WearablesModule {}
