import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LoginResult {
  status: 'ok' | 'mfa_required';
  token?: string;
  mfa_ctx?: string;
}

export interface SyncDailyRow {
  data: string;
  passos: number | null;
  kcal_gastas: number | null;
  fc_media: number | null;
  fc_max: number | null;
  sono_min: number | null;
  hrv: number | null;
  distancia_m: number | null;
  minutos_ativos: number | null;
  fonte: string;
  raw: Record<string, unknown>;
}

export interface SyncActivity {
  inicio: string;
  fim: string | null;
  tipo: string;
  kcal: number | null;
  fc_media: number | null;
  fc_max: number | null;
  distancia_m: number | null;
  raw: Record<string, unknown>;
}

export interface SyncResult {
  daily: SyncDailyRow[];
  activities: SyncActivity[];
}

/**
 * Cliente HTTP do sidecar Python (apps/connector-garmin). Toda a comunicação é
 * interna e autenticada por um segredo compartilhado (X-Connector-Secret).
 */
@Injectable()
export class GarminConnectorClient {
  private readonly logger = new Logger(GarminConnectorClient.name);

  constructor(private readonly cfg: ConfigService) {}

  private get baseUrl(): string {
    return this.cfg.get<string>('GARMIN_CONNECTOR_URL') ?? 'http://localhost:8000';
  }

  private get secret(): string {
    return this.cfg.get<string>('GARMIN_CONNECTOR_SECRET') ?? '';
  }

  private async call<T>(path: string, body: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Connector-Secret': this.secret,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      this.logger.error(`Sidecar Garmin inacessível: ${e}`);
      throw new ServiceUnavailableException('Serviço de conexão Garmin indisponível');
    }
    if (!res.ok) {
      let detail = await res.text();
      // O sidecar (FastAPI) responde erros como {"detail":"..."}; extrai a
      // mensagem real para propagá-la ao cliente em vez do JSON cru.
      try {
        const j = JSON.parse(detail) as { detail?: string };
        if (j?.detail) detail = j.detail;
      } catch {
        /* mantém o texto cru */
      }
      throw new GarminConnectorError(res.status, detail);
    }
    return res.json() as Promise<T>;
  }

  login(email: string, password: string): Promise<LoginResult> {
    return this.call<LoginResult>('/login', { email, password });
  }

  loginMfa(mfaCtx: string, code: string): Promise<LoginResult> {
    return this.call<LoginResult>('/login/mfa', { mfa_ctx: mfaCtx, code });
  }

  sync(token: string, sinceDate: string | null, days = 3): Promise<SyncResult> {
    return this.call<SyncResult>('/sync', { token, since_date: sinceDate, days });
  }
}

export class GarminConnectorError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(`Garmin connector ${status}: ${detail}`);
  }
}
