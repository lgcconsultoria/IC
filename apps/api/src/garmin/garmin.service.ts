import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase.module';
import type { AppUser } from '../auth/app-user';
import {
  GarminConnectorClient,
  GarminConnectorError,
  type SyncResult,
} from './garmin-connector.client';
import { decryptSecret, encryptSecret } from './token-crypto';

type ConnStatus =
  | 'pending'
  | 'active'
  | 'mfa_pending'
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

  private get storePassword(): boolean {
    // Decisão do cliente: guardar a senha (criptografada) p/ re-login silencioso.
    return this.cfg.get<string>('GARMIN_STORE_PASSWORD') !== 'false';
  }

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
    if (!data) {
      throw new NotFoundException(
        'Somente pacientes podem conectar o Garmin (usuário sem cadastro de paciente)',
      );
    }
    return data.id as string;
  }

  // ---- Fluxo de conexão --------------------------------------------------- //

  /** Passo 1: login com email/senha. Pode exigir MFA. */
  async connect(user: AppUser, email: string, password: string) {
    const patientId = await this.resolvePatientId(user);
    let result;
    try {
      result = await this.connector.login(email, password);
    } catch (e) {
      if (e instanceof GarminConnectorError && e.status === 401) {
        throw new UnauthorizedException('E-mail ou senha do Garmin inválidos');
      }
      throw e;
    }

    const secrets: Record<string, string> = {};
    if (this.storePassword) secrets.password_enc = encryptSecret(password);

    if (result.status === 'mfa_required') {
      secrets.mfa_ctx_enc = encryptSecret(result.mfa_ctx!);
      await this.saveSecrets(patientId, secrets);
      await this.setStatus(patientId, 'mfa_pending', { garmin_email: email });
      return { mfaRequired: true };
    }

    // Sem MFA — token obtido direto
    secrets.token_enc = encryptSecret(result.token!);
    await this.saveSecrets(patientId, secrets);
    await this.markConnected(patientId, email);
    void this.backfill(patientId);
    return { connected: true };
  }

  /** Passo 2: conclui o login informando o código MFA. */
  async submitMfa(user: AppUser, code: string) {
    const patientId = await this.resolvePatientId(user);
    const secrets = await this.loadSecrets(patientId);
    if (!secrets?.mfa_ctx_enc) {
      throw new BadRequestException('Nenhum login aguardando MFA. Conecte novamente.');
    }
    const mfaCtx = decryptSecret(secrets.mfa_ctx_enc);

    let result;
    try {
      result = await this.connector.loginMfa(mfaCtx, code);
    } catch (e) {
      if (e instanceof GarminConnectorError && e.status === 401) {
        throw new UnauthorizedException('Código MFA inválido ou expirado');
      }
      throw e;
    }

    await this.saveSecrets(patientId, {
      token_enc: encryptSecret(result.token!),
      mfa_ctx_enc: '',
    });
    const email = (await this.getConnection(patientId))?.garmin_email ?? null;
    await this.markConnected(patientId, email);
    void this.backfill(patientId);
    return { connected: true };
  }

  /** Status da conexão do paciente autenticado. */
  async status(user: AppUser) {
    const patientId = await this.resolvePatientId(user);
    const conn = await this.getConnection(patientId);
    return {
      status: (conn?.status as ConnStatus) ?? 'disconnected',
      garminEmail: conn?.garmin_email ?? null,
      lastSyncAt: conn?.last_sync_at ?? null,
    };
  }

  /** Desconecta: apaga segredos e marca a conexão como inativa. */
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

  /**
   * Coleta e persiste os dados do paciente desde `sinceDate` (ou janela padrão).
   * Faz re-login silencioso com a senha guardada se o token estiver inválido.
   */
  async syncPatient(patientId: string, sinceDate: string | null): Promise<void> {
    const secrets = await this.loadSecrets(patientId);
    if (!secrets?.token_enc) {
      this.logger.warn(`syncPatient sem token (patient=${patientId})`);
      return;
    }
    let token = decryptSecret(secrets.token_enc);

    let result: SyncResult;
    try {
      result = await this.connector.sync(token, sinceDate);
    } catch (e) {
      const isAuth = e instanceof GarminConnectorError && (e.status === 401 || e.status === 502);
      if (isAuth && secrets.password_enc) {
        this.logger.log(`Token Garmin expirado — re-login silencioso (patient=${patientId})`);
        try {
          token = await this.silentRelogin(patientId, secrets.password_enc);
          result = await this.connector.sync(token, sinceDate);
        } catch (re) {
          await this.setStatus(patientId, 'reauth_required', {
            last_error: 'Re-login automático falhou; paciente precisa reconectar',
          });
          this.logger.warn(`Re-login Garmin falhou (patient=${patientId}): ${re}`);
          return;
        }
      } else {
        await this.setStatus(patientId, 'reauth_required', {
          last_error: 'Token inválido; paciente precisa reconectar',
        });
        return;
      }
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

  private async silentRelogin(patientId: string, passwordEnc: string): Promise<string> {
    const email = (await this.getConnection(patientId))?.garmin_email;
    if (!email) throw new Error('email Garmin ausente para re-login');
    const password = decryptSecret(passwordEnc);
    const res = await this.connector.login(email, password);
    if (res.status !== 'ok' || !res.token) {
      // Conta passou a exigir MFA — não dá para reautenticar em silêncio.
      throw new Error('re-login exige MFA');
    }
    await this.saveSecrets(patientId, { token_enc: encryptSecret(res.token) });
    return res.token;
  }

  private async persist(patientId: string, result: SyncResult): Promise<void> {
    if (result.daily.length > 0) {
      const rows = result.daily.map((d) => ({ patient_id: patientId, ...d }));
      const { error } = await this.db
        .from('wearable_daily')
        .upsert(rows, { onConflict: 'patient_id,data,fonte' });
      if (error) this.logger.error(`upsert wearable_daily: ${error.message}`);
    }
    if (result.activities.length > 0) {
      const acts = result.activities.map((a) => ({ patient_id: patientId, ...a }));
      const { error } = await this.db
        .from('wearable_activities')
        .upsert(acts, { onConflict: 'patient_id,inicio,tipo' });
      if (error) this.logger.error(`upsert wearable_activities: ${error.message}`);
    }
  }

  // ---- Persistência auxiliar --------------------------------------------- //

  private async markConnected(patientId: string, email: string | null): Promise<void> {
    await this.setStatus(patientId, 'active', email ? { garmin_email: email } : {});
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
      .upsert(
        { patient_id: patientId, status, ...extra },
        { onConflict: 'patient_id' },
      );
  }

  private async getConnection(
    patientId: string,
  ): Promise<{ status: string; garmin_email: string | null; last_sync_at: string | null } | null> {
    const { data } = await this.db
      .from('garmin_connections')
      .select('status, garmin_email, last_sync_at')
      .eq('patient_id', patientId)
      .maybeSingle();
    return data as never;
  }

  private async saveSecrets(
    patientId: string,
    fields: Record<string, string>,
  ): Promise<void> {
    // string vazia significa "limpar" o campo (ex.: mfa_ctx após concluir MFA)
    const payload: Record<string, unknown> = { patient_id: patientId };
    for (const [k, v] of Object.entries(fields)) payload[k] = v === '' ? null : v;
    await this.db.from('garmin_secrets').upsert(payload, { onConflict: 'patient_id' });
  }

  private async loadSecrets(
    patientId: string,
  ): Promise<{ token_enc?: string; password_enc?: string; mfa_ctx_enc?: string } | null> {
    const { data } = await this.db
      .from('garmin_secrets')
      .select('token_enc, password_enc, mfa_ctx_enc')
      .eq('patient_id', patientId)
      .maybeSingle();
    return (data as never) ?? null;
  }
}
