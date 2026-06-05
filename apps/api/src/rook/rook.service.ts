import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ROOK_SANDBOX = 'https://api.rook-connect.review';
const ROOK_PROD = 'https://api.rook-connect.com';
const CONNECTIONS_SANDBOX = 'https://connections.rook-connect.review';
const CONNECTIONS_PROD = 'https://connections.rook-connect.com';

@Injectable()
export class RookService {
  private readonly logger = new Logger(RookService.name);
  private readonly base: string;
  private readonly connectionsBase: string;
  private readonly clientUuid: string;
  private readonly secret: string;

  constructor(private cfg: ConfigService) {
    const isProd = cfg.get('ROOK_ENV') === 'production';
    this.base = isProd ? ROOK_PROD : ROOK_SANDBOX;
    this.connectionsBase = isProd ? CONNECTIONS_PROD : CONNECTIONS_SANDBOX;
    this.clientUuid = cfg.getOrThrow('ROOK_CLIENT_UUID');
    this.secret = cfg.getOrThrow('ROOK_SECRET');
  }

  private get auth() {
    return 'Basic ' + Buffer.from(`${this.clientUuid}:${this.secret}`).toString('base64');
  }

  private async rook<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.auth,
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ROOK ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  /** URL da Connection Page do ROOK para um usuário. */
  connectionUrl(userId: string, redirectUrl?: string): string {
    let url = `${this.connectionsBase}/client_uuid/${this.clientUuid}/user_id/${encodeURIComponent(userId)}`;
    if (redirectUrl) url += `?redirect_url=${encodeURIComponent(redirectUrl)}`;
    return url;
  }

  /** Registra um user_id no ROOK (idempotente). */
  async registerUser(userId: string): Promise<void> {
    try {
      await this.rook(`/api/v1/user_id/${encodeURIComponent(userId)}/register`, { method: 'POST', body: '{}' });
    } catch (e) {
      this.logger.warn(`registerUser ${userId}: ${e}`);
    }
  }

  /** Lista data sources autorizadas para o usuário. */
  async getDataSources(userId: string) {
    return this.rook<{ data_sources: { data_source: string; authorized: boolean; image: string }[] }>(
      `/api/v1/user_id/${encodeURIComponent(userId)}/data_sources`,
    );
  }

  /** Busca resumo físico de um dia. */
  async getPhysicalSummary(userId: string, date: string) {
    return this.rook<unknown>(
      `/api/v1/user_id/${encodeURIComponent(userId)}/physical/summary?date=${date}`,
    );
  }

  /** Busca resumo de sono de um dia. */
  async getSleepSummary(userId: string, date: string) {
    return this.rook<unknown>(
      `/api/v1/user_id/${encodeURIComponent(userId)}/sleep/summary?date=${date}`,
    );
  }
}
