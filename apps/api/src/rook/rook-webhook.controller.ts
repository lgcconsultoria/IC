import { Body, Controller, Headers, HttpCode, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { RookWebhookService } from './rook-webhook.service';

@Controller('webhooks/rook')
export class RookWebhookController {
  private readonly logger = new Logger(RookWebhookController.name);

  constructor(private readonly svc: RookWebhookService) {}

  @Post()
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handle(
    @Headers('x-rook-hash') rookHash: string | undefined,
    @Body() payload: unknown,
  ) {
    if (!this.verifyHmac(JSON.stringify(payload ?? {}), rookHash)) {
      throw new UnauthorizedException('Assinatura ROOK inválida');
    }
    this.svc.process(payload as never).catch((e) => this.logger.error('Webhook ROOK erro:', e));
    return { received: true };
  }

  private verifyHmac(rawBody: string, hash?: string): boolean {
    const secret = process.env.ROOK_SECRET;
    if (!secret) {
      this.logger.warn('ROOK_SECRET ausente — verificação HMAC ignorada (dev)');
      return true;
    }
    if (!hash) return false;

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(hash, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
