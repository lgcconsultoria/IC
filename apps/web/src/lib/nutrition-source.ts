/* IC Clínica — Nutrição: cardápio, diário alimentar e IA de foto→calorias. */
import { apiFetch } from './api';

export interface MealPlanItem {
  id?: string;
  refeicao: string;
  descricao: string | null;
  kcal_estimada: number | null;
}

export interface MealPlan {
  id: string;
  titulo: string;
  kcal_meta_dia: number | null;
  itens: MealPlanItem[];
}

export interface FoodLog {
  id: string;
  data: string;
  refeicao: string;
  descricao: string | null;
  kcal_estimada: number | null;
  fonte: 'manual' | 'ia';
}

export interface FoodLogsResult {
  logs: FoodLog[];
  total_kcal: number;
  kcal_meta_dia: number | null;
}

export interface MealEstimate {
  descricao: string;
  kcal_total: number;
  confianca: number;
  itens: { alimento: string; porcao: string; kcal: number }[];
}

export interface SaveMealPlanInput {
  titulo?: string;
  kcalMetaDia?: number;
  itens: { refeicao: string; descricao?: string; kcalEstimada?: number }[];
}

export async function loadMealPlan(id: string): Promise<MealPlan | null> {
  try {
    return await apiFetch<MealPlan | null>(`/patients/${id}/meal-plan`);
  } catch {
    return null;
  }
}

export async function saveMealPlan(
  id: string,
  plan: SaveMealPlanInput,
): Promise<MealPlan | null> {
  try {
    return await apiFetch<MealPlan>(`/patients/${id}/meal-plan`, {
      method: 'PUT',
      body: JSON.stringify(plan),
    });
  } catch {
    return null;
  }
}

export async function loadFoodLogs(
  id: string,
  date: string,
): Promise<FoodLogsResult> {
  try {
    return await apiFetch<FoodLogsResult>(`/patients/${id}/food-logs?date=${date}`);
  } catch {
    return { logs: [], total_kcal: 0, kcal_meta_dia: null };
  }
}

export interface NewFoodLog {
  data: string;
  refeicao: string;
  descricao?: string;
  kcalEstimada?: number;
  fonte?: 'manual' | 'ia';
  iaPayload?: Record<string, unknown>;
}

export async function addFoodLog(id: string, log: NewFoodLog): Promise<boolean> {
  try {
    await apiFetch(`/patients/${id}/food-logs`, {
      method: 'POST',
      body: JSON.stringify(log),
    });
    return true;
  } catch {
    return false;
  }
}

// ----- Metabolismo (TMB / TDEE / balanço calórico) -----

export type NivelAtividade =
  | 'sedentario'
  | 'leve'
  | 'moderado'
  | 'intenso'
  | 'muito_intenso';

export interface Metabolism {
  sexo: string | null;
  idade: number | null;
  altura_cm: number | null;
  peso_kg: number | null;
  nivel_atividade: NivelAtividade;
  fator_atividade: number;
  tmb_calculado: number | null;
  tmb_medido_kcal: number | null;
  tmb_medido_em: string | null;
  tmb: number | null;
  tmb_fonte: 'medido' | 'calculado' | null;
  tdee: number | null;
  consumido_hoje: number;
  gasto_hoje: number | null;
  gasto_fonte: 'wearable' | 'tdee' | null;
  saldo_hoje: number | null;
  balanco: 'deficit' | 'superavit' | 'neutro' | null;
}

export interface UpdateMetabolismInput {
  pesoKg?: number;
  nivelAtividade?: NivelAtividade;
  tmbMedidoKcal?: number;
}

export const NIVEL_ATIVIDADE_LABEL: Record<NivelAtividade, string> = {
  sedentario: 'Sedentário (pouco ou nenhum exercício)',
  leve: 'Leve (1–3 dias/semana)',
  moderado: 'Moderado (3–5 dias/semana)',
  intenso: 'Intenso (6–7 dias/semana)',
  muito_intenso: 'Muito intenso (2x/dia ou trabalho físico)',
};

export async function loadMetabolism(id: string): Promise<Metabolism | null> {
  try {
    return await apiFetch<Metabolism>(`/patients/${id}/metabolism`);
  } catch {
    return null;
  }
}

export async function saveMetabolism(
  id: string,
  input: UpdateMetabolismInput,
): Promise<Metabolism | null> {
  try {
    return await apiFetch<Metabolism>(`/patients/${id}/metabolism`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  } catch {
    return null;
  }
}

/** Envia a foto (base64) para a IA estimar alimentos e calorias.
 *  Lança em caso de erro (com o motivo real) para o chamador exibir. */
export async function analyzeMealPhoto(
  imageBase64: string,
  mediaType: string,
): Promise<MealEstimate> {
  return apiFetch<MealEstimate>('/nutrition/analyze-photo', {
    method: 'POST',
    body: JSON.stringify({ imageBase64, mediaType }),
  });
}

/** Extrai uma mensagem legível do erro da API (statusCode/message/detail). */
export function readableApiError(err: unknown): string | null {
  if (!(err instanceof Error)) return null;
  const m = err.message.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const body = JSON.parse(m[0]) as { message?: string | string[]; detail?: string };
      const msg = Array.isArray(body.message) ? body.message[0] : body.message;
      if (msg) return msg;
      if (body.detail) return body.detail;
    } catch { /* ignore */ }
  }
  return err.message.replace(/^API \d+:\s*/, '') || null;
}
