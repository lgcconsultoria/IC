import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase.module';

const ROOK_SANDBOX = 'https://api.rook-connect.review';
const ROOK_PROD = 'https://api.rook-connect.com';
const CONNECTIONS_SANDBOX = 'https://connections.rook-connect.review';
const CONNECTIONS_PROD = 'https://connections.rook-connect.com';

@Injectable()
export class RookService {
  private readonly logger = new Logger(RookService.name);
  private readonly base: string;
  private readonly connectionsBase: string;

  constructor(
    private cfg: ConfigService,
    @Inject(SUPABASE_ADMIN) private readonly db: SupabaseClient,
  ) {
    const isProd = cfg.get('ROOK_ENV') === 'production';
    this.base = isProd ? ROOK_PROD : ROOK_SANDBOX;
    this.connectionsBase = isProd ? CONNECTIONS_PROD : CONNECTIONS_SANDBOX;
  }

  private get clientUuid(): string {
    return this.cfg.get<string>('ROOK_CLIENT_UUID') ?? '';
  }

  private get secret(): string {
    return this.cfg.get<string>('ROOK_SECRET') ?? '';
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
        'User-Agent': 'ClinicaIC/1.0.0', // obrigatório pelo WAF da ROOK
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ROOK ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  /** URL da Connection Page sandbox (teste). Para produção use getAuthorizerUrl(). */
  connectionUrl(userId: string, redirectUrl?: string): string {
    let url = `${this.connectionsBase}/client_uuid/${this.clientUuid}/user_id/${encodeURIComponent(userId)}`;
    if (redirectUrl) url += `?redirect_url=${encodeURIComponent(redirectUrl)}`;
    return url;
  }

  /** Endpoint de autorização por fonte (fluxo produção). */
  async getAuthorizerUrl(userId: string, dataSource: string, redirectUrl?: string) {
    let path = `/api/v1/user_id/${encodeURIComponent(userId)}/data_source/${dataSource}/authorizer`;
    if (redirectUrl) path += `?redirect_url=${encodeURIComponent(redirectUrl)}`;
    return this.rook<{ data_source: string; authorized: boolean; authorization_url: string }>(path);
  }

  /** Revoga autorização de uma fonte para o usuário. */
  async revokeAuth(userId: string, dataSource: string) {
    return this.rook(`/api/v1/user_id/${encodeURIComponent(userId)}/data_sources/revoke_auth`, {
      method: 'POST',
      body: JSON.stringify({ data_source: dataSource }),
    });
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

  /** Mapeia rook_user_id → patient após callback OAuth. */
  async syncUser(supabaseUserId: string, rookUserId: string) {
    // Find the patient whose user has this auth_uid
    const { data: patient } = await this.db
      .from('patients')
      .select('id, user_id')
      .eq('user_id', (await this.db.from('users').select('id').eq('auth_uid', supabaseUserId).single()).data?.id ?? '')
      .maybeSingle();

    if (patient) {
      // Upsert wearable_connections with the rook user id
      await this.db.from('wearable_connections').upsert(
        { patient_id: patient.id, provedor: 'ROOK', terra_user_id: rookUserId, status: 'ativo' },
        { onConflict: 'patient_id,provedor' },
      );
    }
    return { synced: true, rookUserId };
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
