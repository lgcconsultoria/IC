import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase.module';
import { AppUser, isStaff } from '../auth/app-user';
import type { CreatePatientDto } from './dto/create-patient.dto';
import type { CreateMeasurementDto } from './dto/create-measurement.dto';
import type { UpdateGoalsDto } from './dto/update-goals.dto';
import type { NivelAtividade, UpdateMetabolismDto } from './dto/update-metabolism.dto';

/** Fatores de atividade física (multiplicador da TMB para chegar ao TDEE). */
const FATOR_ATIVIDADE: Record<NivelAtividade, number> = {
  sedentario: 1.2,
  leve: 1.375,
  moderado: 1.55,
  intenso: 1.725,
  muito_intenso: 1.9,
};
const NIVEL_ATIVIDADE_PADRAO: NivelAtividade = 'moderado';

/**
 * Regras de acesso aplicadas em código (o client admin faz bypass de RLS):
 *   - apenas equipe cria/edita/lista pacientes, sempre dentro da sua clínica;
 *   - paciente só acessa o próprio registro.
 */
@Injectable()
export class PatientsService {
  constructor(
    @Inject(SUPABASE_ADMIN) private readonly db: SupabaseClient,
    private readonly cfg: ConfigService,
  ) {}

  async list(user: AppUser) {
    this.assertStaff(user);
    const { data, error } = await this.db
      .from('patients')
      .select('id, nome:users(nome), user_id, objetivo, ativo, created_at')
      .eq('clinic_id', user.clinicId)
      .order('created_at', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async create(user: AppUser, dto: CreatePatientDto) {
    this.assertStaff(user);

    // 1) cria a linha em users (role=paciente) na clínica da equipe
    const { data: newUser, error: userErr } = await this.db
      .from('users')
      .insert({
        clinic_id: user.clinicId,
        role: 'paciente',
        nome: dto.nome,
        email: dto.email,
        phone: dto.phone ?? null,
      })
      .select('id')
      .single();
    if (userErr || !newUser) {
      throw new InternalServerErrorException(
        userErr?.message ?? 'Falha ao criar usuário',
      );
    }

    // 2) cria a linha em patients vinculada
    const { data: patient, error: patErr } = await this.db
      .from('patients')
      .insert({
        clinic_id: user.clinicId,
        user_id: newUser.id,
        data_nasc: dto.dataNasc ?? null,
        sexo: dto.sexo ?? null,
        altura_cm: dto.alturaCm ?? null,
        objetivo: dto.objetivo ?? null,
      })
      .select('id, clinic_id, user_id, objetivo, ativo')
      .single();
    if (patErr || !patient) {
      throw new InternalServerErrorException(
        patErr?.message ?? 'Falha ao criar paciente',
      );
    }

    // Send invite email so patient can set password and connect wearable
    try {
      const supabaseUrl = this.cfg.get<string>('SUPABASE_URL') ?? '';
      const serviceKey = this.cfg.get<string>('SUPABASE_SECRET_KEY') ?? '';
      const appUrl = this.cfg.get<string>('APP_URL') ?? 'https://ic-web.vercel.app';
      await fetch(`${supabaseUrl}/auth/v1/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          email: dto.email,
          data: { nome: dto.nome, role: 'paciente' },
          redirect_to: `${appUrl}/portal/conectar`,
        }),
      });
    } catch {
      // Invite email failure is non-fatal — patient row was already created
    }

    return patient;
  }

  /** Paciente vinculado ao usuário logado (portal do paciente). */
  async findMine(user: AppUser) {
    const { data, error } = await this.db
      .from('patients')
      .select('id, clinic_id, user_id, objetivo, altura_cm, sexo, data_nasc')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Paciente não encontrado para este usuário');
    return data;
  }

  async findOne(user: AppUser, patientId: string) {
    const { data, error } = await this.db
      .from('patients')
      .select(
        'id, clinic_id, user_id, data_nasc, sexo, altura_cm, objetivo, ativo, peso_kg, nivel_atividade, tmb_medido_kcal, tmb_medido_em',
      )
      .eq('id', patientId)
      .single();
    if (error || !data) throw new NotFoundException('Paciente não encontrado');
    await this.assertCanAccess(user, data.clinic_id, data.user_id);
    return data;
  }

  async addMeasurement(
    user: AppUser,
    patientId: string,
    dto: CreateMeasurementDto,
  ) {
    const patient = await this.findOne(user, patientId);
    this.assertStaff(user); // somente equipe registra medições

    const imc = this.computeImc(dto.pesoKg, patient.altura_cm);
    const { data, error } = await this.db
      .from('measurements')
      .insert({
        patient_id: patientId,
        data: dto.data,
        peso_kg: dto.pesoKg ?? null,
        imc,
        percentual_gordura: dto.percentualGordura ?? null,
        circ_cintura: dto.circCintura ?? null,
        obs: dto.obs ?? null,
      })
      .select('id, data, peso_kg, imc, percentual_gordura, circ_cintura')
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async listMeasurements(user: AppUser, patientId: string) {
    await this.findOne(user, patientId); // valida acesso
    const { data, error } = await this.db
      .from('measurements')
      .select('id, data, peso_kg, imc, percentual_gordura, circ_cintura, obs')
      .eq('patient_id', patientId)
      .order('data', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  /** Série diária de wearables (Garmin) dos últimos `days` dias. */
  async listWearableDaily(user: AppUser, patientId: string, days = 30) {
    await this.findOne(user, patientId); // valida acesso
    const since = new Date();
    since.setDate(since.getDate() - Math.max(1, Math.min(days, 180)));
    const { data, error } = await this.db
      .from('wearable_daily')
      .select(
        'data, passos, kcal_gastas, fc_media, fc_max, sono_min, hrv, distancia_m, minutos_ativos, fonte',
      )
      .eq('patient_id', patientId)
      .gte('data', since.toISOString().slice(0, 10))
      .order('data', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  /** Atividades/treinos individuais (Garmin) dos últimos `days` dias. */
  async listWearableActivities(user: AppUser, patientId: string, days = 30) {
    await this.findOne(user, patientId); // valida acesso
    const since = new Date();
    since.setDate(since.getDate() - Math.max(1, Math.min(days, 180)));
    const { data, error } = await this.db
      .from('wearable_activities')
      .select('id, inicio, fim, tipo, kcal, fc_media, fc_max, distancia_m')
      .eq('patient_id', patientId)
      .gte('inicio', since.toISOString())
      .order('inicio', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  /** Metas prescritas do paciente (null se ainda não definidas). */
  async getGoals(user: AppUser, patientId: string) {
    await this.findOne(user, patientId);
    const { data, error } = await this.db
      .from('patient_goals')
      .select(
        'meta_passos, meta_kcal, meta_treinos, meta_min_ativos, meta_sono_h, meta_peso_kg, updated_at',
      )
      .eq('patient_id', patientId)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  /** Cria/atualiza as metas do paciente (somente equipe). */
  async saveGoals(user: AppUser, patientId: string, dto: UpdateGoalsDto) {
    await this.findOne(user, patientId);
    this.assertStaff(user);
    const { data, error } = await this.db
      .from('patient_goals')
      .upsert(
        {
          patient_id: patientId,
          meta_passos: dto.metaPassos ?? null,
          meta_kcal: dto.metaKcal ?? null,
          meta_treinos: dto.metaTreinos ?? null,
          meta_min_ativos: dto.metaMinAtivos ?? null,
          meta_sono_h: dto.metaSonoH ?? null,
          meta_peso_kg: dto.metaPesoKg ?? null,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'patient_id' },
      )
      .select(
        'meta_passos, meta_kcal, meta_treinos, meta_min_ativos, meta_sono_h, meta_peso_kg, updated_at',
      )
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  // ----- Metabolismo (TMB / TDEE / balanço calórico) -----

  /**
   * Perfil metabólico completo do paciente:
   *   - TMB calculada (Mifflin-St Jeor) a partir de sexo/idade/altura/peso;
   *   - TMB medida (calorimetria/InBody digitada pela clínica) substitui a calculada;
   *   - TDEE = TMB × fator de atividade;
   *   - balanço do dia = consumido (diário alimentar) − gasto (wearable ou TDEE).
   */
  async getMetabolism(user: AppUser, patientId: string) {
    const patient = await this.findOne(user, patientId); // valida acesso

    // peso: prioriza patients.peso_kg; senão a última medição
    let pesoKg: number | null =
      (patient as { peso_kg?: number | null }).peso_kg ?? null;
    if (pesoKg == null) {
      const { data: m } = await this.db
        .from('measurements')
        .select('peso_kg')
        .eq('patient_id', patientId)
        .not('peso_kg', 'is', null)
        .order('data', { ascending: false })
        .limit(1)
        .maybeSingle();
      pesoKg = m?.peso_kg ?? null;
    }

    const nivel =
      ((patient as { nivel_atividade?: NivelAtividade | null }).nivel_atividade ??
        null) || NIVEL_ATIVIDADE_PADRAO;
    const fator = FATOR_ATIVIDADE[nivel] ?? FATOR_ATIVIDADE[NIVEL_ATIVIDADE_PADRAO];
    const idade = this.idadeDe(patient.data_nasc);
    const tmbMedido =
      (patient as { tmb_medido_kcal?: number | null }).tmb_medido_kcal ?? null;

    const tmbCalculado = this.mifflinStJeor(
      patient.sexo,
      pesoKg,
      patient.altura_cm,
      idade,
    );
    // a calorimetria medida é a fonte mais fiel; senão usa a fórmula
    const tmb = tmbMedido ?? tmbCalculado;
    const tdee = tmb != null ? Math.round(tmb * fator) : null;

    // gasto real do dia (wearable) tem prioridade sobre o TDEE estimado
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: wd } = await this.db
      .from('wearable_daily')
      .select('kcal_gastas')
      .eq('patient_id', patientId)
      .eq('data', hoje)
      .maybeSingle();
    const gastoWearable = wd?.kcal_gastas ?? null;
    const gastoDia = gastoWearable ?? tdee;

    // consumido hoje (diário alimentar)
    const { data: logs } = await this.db
      .from('food_logs')
      .select('kcal_estimada')
      .eq('patient_id', patientId)
      .eq('data', hoje);
    const consumidoHoje = (logs ?? []).reduce(
      (acc, r) => acc + (Number(r.kcal_estimada) || 0),
      0,
    );

    const saldo = gastoDia != null ? consumidoHoje - gastoDia : null; // <0 déficit, >0 superávit

    return {
      sexo: patient.sexo ?? null,
      idade,
      altura_cm: patient.altura_cm ?? null,
      peso_kg: pesoKg,
      nivel_atividade: nivel,
      fator_atividade: fator,
      tmb_calculado: tmbCalculado,
      tmb_medido_kcal: tmbMedido,
      tmb_medido_em:
        (patient as { tmb_medido_em?: string | null }).tmb_medido_em ?? null,
      tmb: tmb, // valor efetivamente usado (medido ou calculado)
      tmb_fonte: tmbMedido != null ? 'medido' : tmbCalculado != null ? 'calculado' : null,
      tdee,
      consumido_hoje: consumidoHoje,
      gasto_hoje: gastoDia,
      gasto_fonte: gastoWearable != null ? 'wearable' : gastoDia != null ? 'tdee' : null,
      saldo_hoje: saldo,
      balanco: saldo == null ? null : saldo < 0 ? 'deficit' : saldo > 0 ? 'superavit' : 'neutro',
    };
  }

  /**
   * Atualiza o perfil metabólico. Paciente pode ajustar o próprio peso e nível
   * de atividade; a TMB medida (calorimetria) só a equipe da clínica define.
   */
  async updateMetabolism(
    user: AppUser,
    patientId: string,
    dto: UpdateMetabolismDto,
  ) {
    await this.findOne(user, patientId); // valida acesso
    const staff = isStaff(user);

    const patch: Record<string, unknown> = {};
    if (dto.pesoKg !== undefined) patch.peso_kg = dto.pesoKg;
    if (dto.nivelAtividade !== undefined) patch.nivel_atividade = dto.nivelAtividade;
    if (dto.tmbMedidoKcal !== undefined) {
      if (!staff) {
        throw new ForbiddenException(
          'Somente a equipe da clínica registra a calorimetria (gasto em repouso medido)',
        );
      }
      patch.tmb_medido_kcal = dto.tmbMedidoKcal;
      patch.tmb_medido_por = user.id;
      patch.tmb_medido_em = new Date().toISOString();
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await this.db
        .from('patients')
        .update(patch)
        .eq('id', patientId);
      if (error) throw new InternalServerErrorException(error.message);
    }
    return this.getMetabolism(user, patientId);
  }

  /** TMB pela equação de Mifflin-St Jeor (kcal/dia). null se faltar dado. */
  private mifflinStJeor(
    sexo: string | null,
    pesoKg: number | null,
    alturaCm: number | null,
    idade: number | null,
  ): number | null {
    if (!pesoKg || !alturaCm || idade == null || !sexo) return null;
    const base = 10 * pesoKg + 6.25 * alturaCm - 5 * idade;
    const ajuste = sexo === 'M' ? 5 : sexo === 'F' ? -161 : -78; // 'outro' ~ média
    return Math.round(base + ajuste);
  }

  private idadeDe(dataNasc: string | null): number | null {
    if (!dataNasc) return null;
    const nasc = new Date(dataNasc);
    if (Number.isNaN(nasc.getTime())) return null;
    const hoje = new Date();
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
    return idade;
  }

  // ----- helpers -----
  private assertStaff(user: AppUser) {
    if (!isStaff(user)) throw new ForbiddenException('Acesso restrito à equipe');
  }

  private async assertCanAccess(
    user: AppUser,
    patientClinicId: string,
    patientUserId: string,
  ) {
    if (isStaff(user)) {
      if (patientClinicId !== user.clinicId) {
        throw new ForbiddenException('Paciente de outra clínica');
      }
      return;
    }
    // paciente: só o próprio registro
    if (patientUserId !== user.id) {
      throw new ForbiddenException('Acesso negado');
    }
  }

  private computeImc(
    pesoKg: number | undefined,
    alturaCm: number | null,
  ): number | null {
    if (!pesoKg || !alturaCm) return null;
    const m = alturaCm / 100;
    return Math.round((pesoKg / (m * m)) * 10) / 10;
  }
}
