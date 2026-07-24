import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase.module';
import { AppUser, isStaff } from '../auth/app-user';

type AlertTipo =
  | 'queda_atividade'
  | 'excesso_carga'
  | 'abaixo_meta'
  | 'sem_dados';

const TIPO_MSG: Record<AlertTipo, string> = {
  queda_atividade: 'Queda significativa de atividade nos últimos dias.',
  excesso_carga: 'Sinais de sobrecarga: HRV abaixo do habitual.',
  abaixo_meta: 'Aderência abaixo da meta de passos prescrita.',
  sem_dados: 'Sem sincronização do wearable nos últimos dias.',
};

@Injectable()
export class AlertsService {
  constructor(@Inject(SUPABASE_ADMIN) private readonly db: SupabaseClient) {}

  /** Lista os alertas da clínica (equipe), com o nome do paciente. */
  async listForClinic(user: AppUser) {
    this.assertStaff(user);
    const { data: alerts, error } = await this.db
      .from('alerts')
      .select('id, patient_id, tipo, severidade, mensagem, status, data')
      .eq('clinic_id', user.clinicId)
      .order('data', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    if (!alerts || alerts.length === 0) return [];

    const ids = [...new Set(alerts.map((a) => a.patient_id as string))];
    const { data: pats } = await this.db
      .from('patients')
      .select('id, nome:users!user_id(nome)')
      .in('id', ids);
    const nameById = new Map<string, string>();
    (pats ?? []).forEach((p) => {
      const n = p.nome as unknown;
      const nome = Array.isArray(n)
        ? ((n[0] as { nome?: string })?.nome ?? 'Paciente')
        : ((n as { nome?: string })?.nome ?? 'Paciente');
      nameById.set(p.id as string, nome);
    });

    return alerts.map((a) => ({
      ...a,
      paciente_nome: nameById.get(a.patient_id as string) ?? 'Paciente',
    }));
  }

  /** Alertas de um paciente específico (equipe da clínica). */
  async listForPatient(user: AppUser, patientId: string) {
    this.assertStaff(user);
    const { data: pat } = await this.db
      .from('patients')
      .select('id, clinic_id')
      .eq('id', patientId)
      .single();
    if (!pat || pat.clinic_id !== user.clinicId) {
      throw new NotFoundException('Paciente não encontrado');
    }
    const { data, error } = await this.db
      .from('alerts')
      .select('id, patient_id, tipo, severidade, mensagem, status, data')
      .eq('patient_id', patientId)
      .order('data', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /** Atualiza o status de um alerta (visto/resolvido), restrito à clínica. */
  async updateStatus(
    user: AppUser,
    alertId: string,
    status: 'aberto' | 'visto' | 'resolvido',
  ) {
    this.assertStaff(user);
    const { data, error } = await this.db
      .from('alerts')
      .update({ status })
      .eq('id', alertId)
      .eq('clinic_id', user.clinicId)
      .select('id, status')
      .single();
    if (error || !data) throw new NotFoundException('Alerta não encontrado');
    return data;
  }

  /**
   * Gera alertas por regras a partir de wearable_daily dos últimos 7 dias.
   * Idempotente: não duplica alertas do mesmo (paciente, tipo) ainda em aberto.
   */
  async refresh(user: AppUser) {
    this.assertStaff(user);
    const { data: patients, error } = await this.db
      .from('patients')
      .select('id')
      .eq('clinic_id', user.clinicId)
      .eq('ativo', true);
    if (error) throw new InternalServerErrorException(error.message);

    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceStr = since.toISOString().slice(0, 10);
    let criados = 0;

    for (const p of patients ?? []) {
      const patientId = p.id as string;
      const rules = await this.evaluatePatient(patientId, sinceStr);
      for (const r of rules) {
        const created = await this.ensureAlert(user.clinicId, patientId, r);
        if (created) criados++;
      }
    }
    return { criados };
  }

  // ----- regras -----
  private async evaluatePatient(
    patientId: string,
    sinceStr: string,
  ): Promise<Array<{ tipo: AlertTipo; severidade: 'baixa' | 'media' | 'alta'; mensagem: string }>> {
    const { data: rows } = await this.db
      .from('wearable_daily')
      .select('data, passos, hrv')
      .eq('patient_id', patientId)
      .gte('data', sinceStr)
      .order('data', { ascending: true });

    const out: Array<{
      tipo: AlertTipo;
      severidade: 'baixa' | 'media' | 'alta';
      mensagem: string;
    }> = [];

    if (!rows || rows.length === 0) {
      out.push({ tipo: 'sem_dados', severidade: 'media', mensagem: TIPO_MSG.sem_dados });
      return out;
    }

    const last = rows[rows.length - 1]!;
    const lastDate = new Date((last.data as string) + 'T00:00:00');
    const diasSemDados = Math.floor((Date.now() - lastDate.getTime()) / 86_400_000);
    if (diasSemDados > 3) {
      out.push({ tipo: 'sem_dados', severidade: 'media', mensagem: TIPO_MSG.sem_dados });
    }

    const passos = rows.map((r) => (r.passos as number) ?? 0).filter((v) => v > 0);
    if (passos.length > 0) {
      const avg = passos.reduce((a, b) => a + b, 0) / passos.length;
      if (avg < 4000) {
        out.push({ tipo: 'queda_atividade', severidade: 'media', mensagem: TIPO_MSG.queda_atividade });
      }
      // abaixo da meta (se houver meta definida)
      const { data: goals } = await this.db
        .from('patient_goals')
        .select('meta_passos')
        .eq('patient_id', patientId)
        .maybeSingle();
      const meta = goals?.meta_passos as number | undefined;
      if (meta && avg < meta * 0.6) {
        out.push({ tipo: 'abaixo_meta', severidade: 'media', mensagem: TIPO_MSG.abaixo_meta });
      }
    }

    const hrvs = rows.map((r) => r.hrv as number | null).filter((v): v is number => v != null);
    if (hrvs.length > 0) {
      const avgHrv = hrvs.reduce((a, b) => a + b, 0) / hrvs.length;
      if (avgHrv < 30) {
        out.push({ tipo: 'excesso_carga', severidade: 'alta', mensagem: TIPO_MSG.excesso_carga });
      }
    }

    return out;
  }

  private async ensureAlert(
    clinicId: string,
    patientId: string,
    rule: { tipo: AlertTipo; severidade: 'baixa' | 'media' | 'alta'; mensagem: string },
  ): Promise<boolean> {
    const { data: existing } = await this.db
      .from('alerts')
      .select('id')
      .eq('patient_id', patientId)
      .eq('tipo', rule.tipo)
      .neq('status', 'resolvido')
      .limit(1);
    if (existing && existing.length > 0) return false;

    const { error } = await this.db.from('alerts').insert({
      clinic_id: clinicId,
      patient_id: patientId,
      tipo: rule.tipo,
      severidade: rule.severidade,
      mensagem: rule.mensagem,
      status: 'aberto',
    });
    return !error;
  }

  private assertStaff(user: AppUser) {
    if (!isStaff(user)) throw new ForbiddenException('Acesso restrito à equipe');
  }
}
