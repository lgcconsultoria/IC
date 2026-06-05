import { Body, Controller, Headers, HttpCode, Logger, Post } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { RookWebhookService } from './rook-webhook.service';

@Controller('webhooks/rook')
export class RookWebhookController {
  private readonly logger = new Logger(RookWebhookController.name);

  constructor(private readonly svc: RookWebhookService) {}

  @Post()
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handle(
    @Headers('client-uuid') clientUuid: string | undefined,
    @Body() payload: unknown,
  ) {
    const expected = process.env.ROOK_CLIENT_UUID;
    if (expected && clientUuid !== expected) {
      this.logger.warn(`Webhook ROOK com client-uuid inesperado: ${clientUuid}`);
    }
    this.svc.process(payload as never).catch((e) => this.logger.error('Webhook ROOK erro:', e));
    return { received: true };
  }
}
