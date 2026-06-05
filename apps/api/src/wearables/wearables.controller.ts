import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { TerraWebhookService } from './terra-webhook.service';

/**
 * Recebe os eventos da Terra API (wearables).
 * O endpoint é público, porém protegido pela verificação de assinatura HMAC.
 * Responde 200 rápido e delega o processamento para uma fila (futuro: BullMQ).
 */
@Controller('webhooks/terra')
export class WearablesController {
  constructor(private readonly terra: TerraWebhookService) {}

  @Post()
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handle(
    @Headers('terra-signature') signature: string | undefined,
    @Body() payload: unknown,
  ) {
    const raw = JSON.stringify(payload ?? {});
    if (!this.terra.verifySignature(raw, signature)) {
      throw new UnauthorizedException('Assinatura Terra inválida');
    }

    // TODO(Fase 3): enfileirar no BullMQ para normalização e upsert idempotente.
    await this.terra.enqueue(payload);
    return { received: true };
  }
}
