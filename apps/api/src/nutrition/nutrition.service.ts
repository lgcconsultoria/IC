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
import { AiService } from '../ai/ai.service';
import type { SaveMealPlanDto } from './dto/save-meal-plan.dto';
import type { CreateFoodLogDto } from './dto/create-food-log.dto';

@Injectable()
export class NutritionService {
  constructor(
    @Inject(SUPABASE_ADMIN) private readonly db: SupabaseClient,
    private readonly ai: AiService,
  ) {}

  // ----- Cardápio (meal_plans + meal_plan_items) -----

  async getMealPlan(user: AppUser, patientId: string) {
    await this.assertAccess(user, patientId);
    const { data: plan, error } = await this.db
      .from('meal_plans')
      .select('id, titulo, kcal_meta_dia, ativo, created_at')
      .eq('patient_id', patientId)
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!plan) return null;

    const { data: itens } = await this.db
      .from('meal_plan_items')
      .select('id, refeicao, descricao, kcal_estimada')
      .eq('meal_plan_id', plan.id);
    return { ...plan, itens: itens ?? [] };
  }

  async saveMealPlan(user: AppUser, patientId: string, dto: SaveMealPlanDto) {
    await this.assertAccess(user, patientId, { staffOnly: true });

    // desativa planos anteriores e cria um novo (histórico preservado)
    await this.db
      .from('meal_plans')
      .update({ ativo: false })
      .eq('patient_id', patientId)
      .eq('ativo', true);

    const { data: plan, error } = await this.db
      .from('meal_plans')
      .insert({
        patient_id: patientId,
        nutri_id: user.id,
        titulo: dto.titulo ?? 'Plano alimentar',
        kcal_meta_dia: dto.kcalMetaDia ?? null,
        ativo: true,
      })
      .select('id')
      .single();
    if (error || !plan) {
      throw new InternalServerErrorException(error?.message ?? 'Falha ao salvar plano');
    }

    if (dto.itens.length > 0) {
      const rows = dto.itens.map((it) => ({
        meal_plan_id: plan.id,
        refeicao: it.refeicao,
        descricao: it.descricao ?? null,
        kcal_estimada: it.kcalEstimada ?? null,
      }));
      const { error: itErr } = await this.db.from('meal_plan_items').insert(rows);
      if (itErr) throw new InternalServerErrorException(itErr.message);
    }
    return this.getMealPlan(user, patientId);
  }

  // ----- Diário alimentar (food_logs) -----

  async listFoodLogs(user: AppUser, patientId: string, date: string) {
    await this.assertAccess(user, patientId);
    const { data, error } = await this.db
      .from('food_logs')
      .select('id, data, refeicao, descricao, kcal_estimada, fonte, created_at')
      .eq('patient_id', patientId)
      .eq('data', date)
      .order('created_at', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);

    const total = (data ?? []).reduce(
      (acc, r) => acc + (Number(r.kcal_estimada) || 0),
      0,
    );
    const plan = await this.getMealPlan(user, patientId);
    return { logs: data ?? [], total_kcal: total, kcal_meta_dia: plan?.kcal_meta_dia ?? null };
  }

  async addFoodLog(user: AppUser, patientId: string, dto: CreateFoodLogDto) {
    await this.assertAccess(user, patientId);
    const { data, error } = await this.db
      .from('food_logs')
      .insert({
        patient_id: patientId,
        data: dto.data,
        refeicao: dto.refeicao,
        descricao: dto.descricao ?? null,
        kcal_estimada: dto.kcalEstimada ?? null,
        fonte: dto.fonte ?? 'manual',
        ia_payload: dto.iaPayload ?? null,
        confirmado_por: user.id,
      })
      .select('id, data, refeicao, descricao, kcal_estimada, fonte')
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  // ----- IA: foto → calorias -----

  async analyzePhoto(base64: string, mediaType: string) {
    return this.ai.analyzeMeal(base64, mediaType);
  }

  // ----- helpers -----

  private async assertAccess(
    user: AppUser,
    patientId: string,
    opts?: { staffOnly?: boolean },
  ) {
    const { data, error } = await this.db
      .from('patients')
      .select('id, clinic_id, user_id')
      .eq('id', patientId)
      .single();
    if (error || !data) throw new NotFoundException('Paciente não encontrado');

    if (isStaff(user)) {
      if (data.clinic_id !== user.clinicId) {
        throw new ForbiddenException('Paciente de outra clínica');
      }
      return;
    }
    if (opts?.staffOnly) throw new ForbiddenException('Acesso restrito à equipe');
    if (data.user_id !== user.id) throw new ForbiddenException('Acesso negado');
  }
}
