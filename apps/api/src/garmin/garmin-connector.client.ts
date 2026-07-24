import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SyncDailyRow {
  data: string;
  sono_min?: number | null;
  hrv?: number | null;
  fonte: string;
  raw?: Record<string, unknown>;
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
 * Cliente HTTP do sidecar Python (apps/connector-garmin), que por sua vez é um
 * cliente MCP do Garmin (via amalgama). Comunicação interna autenticada por um
 * segredo compartilhado (X-Connector-Secret).
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

  /** Coleta dados do paciente a partir da URL MCP dele (via sidecar). */
  async sync(mcpUrl: string, sinceDate: string | null, days = 3): Promise<SyncResult> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Connector-Secret': this.secret,
        },
        body: JSON.stringify({ mcp_url: mcpUrl, since_date: sinceDate, days }),
      });
    } catch (e) {
      this.logger.error(`Sidecar Garmin inacessível: ${e}`);
      throw new ServiceUnavailableException('Serviço de conexão Garmin indisponível');
    }
    if (!res.ok) {
      let detail = await res.text();
      try {
        const j = JSON.parse(detail) as { detail?: string };
        if (j?.detail) detail = j.detail;
      } catch {
        /* mantém o texto cru */
      }
      throw new GarminConnectorError(res.status, detail);
    }
    return res.json() as Promise<SyncResult>;
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
