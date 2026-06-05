import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

@Injectable()
export class TerraWebhookService {
  private readonly logger = new Logger(TerraWebhookService.name);

  /**
   * Verifica a assinatura HMAC enviada pela Terra no header `terra-signature`.
   * Formato típico: "t=<timestamp>,v1=<hmacHex>".
   * Em desenvolvimento, sem TERRA_SIGNING_SECRET, a verificação é ignorada.
   */
  verifySignature(rawBody: string, signatureHeader?: string): boolean {
    const secret = process.env.TERRA_SIGNING_SECRET;
    if (!secret) {
      this.logger.warn(
        'TERRA_SIGNING_SECRET ausente — verificação de assinatura ignorada (apenas dev).',
      );
      return true;
    }
    if (!signatureHeader) return false;

    const parts = Object.fromEntries(
      signatureHeader.split(',').map((kv) => kv.split('=') as [string, string]),
    );
    const timestamp = parts['t'];
    const provided = parts['v1'];
    if (!timestamp || !provided) return false;

    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /** Placeholder de enfileiramento — substituir por BullMQ na Fase 3. */
  async enqueue(payload: unknown): Promise<void> {
    const type = (payload as { type?: string })?.type ?? 'desconhecido';
    this.logger.log(`Evento Terra recebido (type=${type}) — enfileirar.`);
  }
}
