import { Module } from '@nestjs/common';
import { RookService } from './rook.service';
import { RookController } from './rook.controller';
import { RookWebhookController } from './rook-webhook.controller';
import { RookWebhookService } from './rook-webhook.service';

@Module({
  providers: [RookService, RookWebhookService],
  controllers: [RookController, RookWebhookController],
  exports: [RookService],
})
export class RookModule {}
