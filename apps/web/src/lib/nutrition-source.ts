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

/** Envia a foto (base64) para a IA estimar alimentos e calorias. */
export async function analyzeMealPhoto(
  imageBase64: string,
  mediaType: string,
): Promise<MealEstimate | null> {
  try {
    return await apiFetch<MealEstimate>('/nutrition/analyze-photo', {
      method: 'POST',
      body: JSON.stringify({ imageBase64, mediaType }),
    });
  } catch {
    return null;
  }
}
