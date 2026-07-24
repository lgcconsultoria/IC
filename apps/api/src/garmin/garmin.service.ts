import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase.module';
import { type AppUser, isStaff } from '../auth/app-user';
import {
  GarminConnectorClient,
  GarminConnectorError,
  type SyncResult,
} from './garmin-connector.client';
import { decryptSecret, encryptSecret } from './token-crypto';

type ConnStatus =
  | 'pending'
  | 'active'
  | 'reauth_required'
  | 'disconnected'
  | 'error';

@Injectable()
export class GarminService {
  private readonly logger = new Logger(GarminService.name);

  constructor(
    @Inject(SUPABASE_ADMIN) private readonly db: SupabaseClient,
    private readonly connector: GarminConnectorClient,
    private readonly cfg: ConfigService,
  ) {}

  private get backfillDays(): number {
    return Number(this.cfg.get('GARMIN_BACKFILL_DAYS') ?? 30);
  }

  /** Resolve patients.id a partir do usuário autenticado (public.users.id). */
  async resolvePatientId(user: AppUser): Promise<string> {
    const { data, error } = await this.db
      .from('patients')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw new NotFoundException('Falha ao localizar paciente');
    if (data) return data.id as string;

    // Funcionário da equipe conectando o próprio relógio → cria o registro de
    // autoacompanhamento sob demanda (mesma máquina de dados dos pacientes).
    if (isStaff(user)) {
      const { data: created, error: insErr } = await this.db
        .from('patients')
        .insert({
          clinic_id: user.clinicId,
          user_id: user.id,
          eh_funcionario: true,
          objetivo: 'Autoacompanhamento',
        })
        .select('id')
        .single();
      if (insErr || !created) {
        throw new NotFoundException('Falha ao criar autoacompanhamento');
      }
      return created.id as string;
    }

    throw new NotFoundException(
      'Usuário sem cadastro de paciente — peça à clínica para cadastrá-lo',
    );
  }

  // ---- Conexão via URL MCP ------------------------------------------------ //

  /** Conecta o Garmin do paciente guardando a URL MCP dele (do amalgama). */
  async connect(user: AppUser, mcpUrl: string) {
    const patientId = await this.resolvePatientId(user);
    const url = mcpUrl.trim();
    try {
      const parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error('protocolo');
    } catch {
      throw new BadRequestException('URL MCP inválida — cole o link completo do amalgama');
    }
    // A URL MCP é uma credencial (dá acesso aos dados) → guardada criptografada.
    await this.saveSecrets(patientId, { token_enc: encryptSecret(url) });
    await this.markConnected(patientId);
    void this.backfill(patientId);
    return { connected: true };
  }

  /** Status da conexão do paciente autenticado. */
  async status(user: AppUser) {
    const patientId = await this.resolvePatientId(user);
    const conn = await this.getConnection(patientId);
    return {
      status: (conn?.status as ConnStatus) ?? 'disconnected',
      lastSyncAt: conn?.last_sync_at ?? null,
      lastError: conn?.last_error ?? null,
    };
  }

  /** Desconecta: apaga a URL guardada e marca inativo. */
  async disconnect(user: AppUser) {
    const patientId = await this.resolvePatientId(user);
    await this.db.from('garmin_secrets').delete().eq('patient_id', patientId);
    await this.setStatus(patientId, 'disconnected');
    await this.db
      .from('wearable_connections')
      .update({ status: 'inativo' })
      .eq('patient_id', patientId)
      .eq('provedor', 'GARMIN');
    return { disconnected: true };
  }

  // ---- Coleta de dados ---------------------------------------------------- //

  /** Backfill inicial (últimos N dias) após conectar. */
  async backfill(patientId: string): Promise<void> {
    const since = new Date();
    since.setDate(since.getDate() - this.backfillDays);
    await this.syncPatient(patientId, since.toISOString().slice(0, 10)).catch((e) =>
      this.logger.error(`Backfill Garmin falhou (patient=${patientId}): ${e}`),
    );
  }

  /** Coleta e persiste os dados do paciente via MCP desde `sinceDate`. */
  async syncPatient(patientId: string, sinceDate: string | null): Promise<void> {
    const secrets = await this.loadSecrets(patientId);
    if (!secrets?.token_enc) {
      this.logger.warn(`syncPatient sem URL MCP (patient=${patientId})`);
      return;
    }
    const mcpUrl = decryptSecret(secrets.token_enc);

    let result: SyncResult;
    try {
      result = await this.connector.sync(mcpUrl, sinceDate);
    } catch (e) {
      const detail = e instanceof GarminConnectorError ? e.detail : String(e);
      await this.setStatus(patientId, 'error', { last_error: detail.slice(0, 300) });
      this.logger.warn(`Sync MCP falhou (patient=${patientId}): ${detail}`);
      return;
    }

    await this.persist(patientId, result);
    await this.setStatus(patientId, 'active', {
      last_sync_at: new Date().toISOString(),
      last_error: null,
    });
  }

  /** Lista pacientes com conexão ativa (usado pelo poller). */
  async listActivePatientIds(): Promise<string[]> {
    const { data } = await this.db
      .from('garmin_connections')
      .select('patient_id')
      .eq('status', 'active');
    return (data ?? []).map((r) => r.patient_id as string);
  }

  private async persist(patientId: string, result: SyncResult): Promise<void> {
    if (result.daily?.length) {
      const rows = result.daily.map((d) => ({ patient_id: patientId, ...d }));
      const { error } = await this.db
        .from('wearable_daily')
        .upsert(rows, { onConflict: 'patient_id,data,fonte' });
      if (error) this.logger.error(`upsert wearable_daily: ${error.message}`);
    }
    if (result.activities?.length) {
      const acts = result.activities.map((a) => ({ patient_id: patientId, ...a }));
      const { error } = await this.db
        .from('wearable_activities')
        .upsert(acts, { onConflict: 'patient_id,inicio,tipo' });
      if (error) this.logger.error(`upsert wearable_activities: ${error.message}`);
    }
  }

  // ---- Persistência auxiliar --------------------------------------------- //

  private async markConnected(patientId: string): Promise<void> {
    await this.setStatus(patientId, 'active');
    await this.db.from('wearable_connections').upsert(
      { patient_id: patientId, provedor: 'GARMIN', status: 'ativo' },
      { onConflict: 'patient_id,provedor' },
    );
  }

  private async setStatus(
    patientId: string,
    status: ConnStatus,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    await this.db
      .from('garmin_connections')
      .upsert({ patient_id: patientId, status, ...extra }, { onConflict: 'patient_id' });
  }

  private async getConnection(
    patientId: string,
  ): Promise<{ status: string; last_sync_at: string | null; last_error: string | null } | null> {
    const { data } = await this.db
      .from('garmin_connections')
      .select('status, last_sync_at, last_error')
      .eq('patient_id', patientId)
      .maybeSingle();
    return data as never;
  }

  private async saveSecrets(
    patientId: string,
    fields: Record<string, string>,
  ): Promise<void> {
    const payload: Record<string, unknown> = { patient_id: patientId };
    for (const [k, v] of Object.entries(fields)) payload[k] = v === '' ? null : v;
    await this.db.from('garmin_secrets').upsert(payload, { onConflict: 'patient_id' });
  }

  private async loadSecrets(
    patientId: string,
  ): Promise<{ token_enc?: string } | null> {
    const { data } = await this.db
      .from('garmin_secrets')
      .select('token_enc')
      .eq('patient_id', patientId)
      .maybeSingle();
    return (data as never) ?? null;
  }
}
