/* IC Clínica — Fonte de pacientes: tenta a API real, cai para demo. */
import { apiFetch } from './api';
import {
  DATA,
  DEMO,
  apiPatient,
  byId,
  type Patient,
  type ApiPatientLike,
  type SeriesPoint,
} from './clinic-data';

interface ApiPatientRow {
  id: string;
  user_id?: string;
  objetivo: string | null;
  ativo: boolean;
  created_at?: string;
  nome?: { nome: string } | { nome: string }[] | null;
}

export type DataSource = 'api' | 'demo' | 'empty';

export interface PatientsResult {
  patients: Patient[];
  source: DataSource;
}

function nomeDe(row: ApiPatientRow): string {
  if (!row.nome) return 'Paciente';
  return Array.isArray(row.nome) ? row.nome[0]?.nome ?? 'Paciente' : row.nome.nome;
}

function toApiLike(row: ApiPatientRow): ApiPatientLike {
  return { id: row.id, name: nomeDe(row), objetivo: row.objetivo };
}

/** Estado vazio honesto (ou demo, se NEXT_PUBLIC_DEMO=1). */
function emptyOrDemo(): PatientsResult {
  return DEMO
    ? { patients: DATA.patients, source: 'demo' }
    : { patients: [], source: 'empty' };
}

/** Lista de pacientes para o painel: API real quando disponível, senão vazio/demo. */
export async function loadClinicPatients(): Promise<PatientsResult> {
  try {
    const rows = await apiFetch<ApiPatientRow[]>('/patients');
    if (Array.isArray(rows)) {
      if (rows.length > 0) {
        return { patients: rows.map((r) => apiPatient(toApiLike(r))), source: 'api' };
      }
      // API respondeu, mas a clínica ainda não tem pacientes → estado vazio.
      return emptyOrDemo();
    }
  } catch {
    /* sem sessão / API indisponível */
  }
  return emptyOrDemo();
}

/** Um paciente pelo id: API real (view-model honesto) ou demo (p1..p15). */
export async function loadPatient(id: string): Promise<Patient | null> {
  if (DEMO) {
    const demo = byId(id);
    if (demo) return demo;
  }
  try {
    const row = await apiFetch<ApiPatientRow & { altura_cm?: number | null; sexo?: 'F' | 'M' | 'outro' | null }>(`/patients/${id}`);
    if (row && row.id) {
      return apiPatient({
        id: row.id,
        name: nomeDe(row),
        objetivo: row.objetivo,
        sexo: row.sexo ?? null,
        alturaCm: row.altura_cm ?? null,
      });
    }
  } catch {
    /* ignore */
  }
  return null;
}

// ----- Wearables reais (ROOK) -------------------------------------------------

export interface WearableDailyRow {
  data: string;
  passos: number | null;
  kcal_gastas: number | null;
  fc_media: number | null;
  fc_max: number | null;
  sono_min: number | null;
  hrv: number | null;
  minutos_ativos: number | null;
}

/** Busca a série diária real de wearables; [] se não houver/indisponível. */
export async function loadPatientWearables(
  id: string,
  days = 30,
): Promise<WearableDailyRow[]> {
  try {
    const rows = await apiFetch<WearableDailyRow[]>(
      `/patients/${id}/wearable-daily?days=${days}`,
    );
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function toSeries(
  rows: WearableDailyRow[],
  pick: (r: WearableDailyRow) => number | null,
  transform?: (v: number) => number,
): SeriesPoint[] {
  return rows
    .filter((r) => pick(r) != null)
    .map((r) => {
      const raw = pick(r) as number;
      const v = transform ? transform(raw) : raw;
      const d = new Date(r.data + 'T00:00:00');
      return { date: r.data, day: d.getDay(), value: v };
    });
}

function avgLast(s: SeriesPoint[], n: number): number {
  const slice = s.slice(-n);
  if (slice.length === 0) return 0;
  return slice.reduce((a, p) => a + p.value, 0) / slice.length;
}

/**
 * Sobrepõe os dados sintéticos com os dados REAIS de wearable quando existem.
 * Cada série só é substituída se houver pontos reais; resumo recalculado.
 */
export function applyRealWearables(
  p: Patient,
  rows: WearableDailyRow[],
): Patient {
  if (rows.length === 0) return p;
  const steps = toSeries(rows, (r) => r.passos);
  const calories = toSeries(rows, (r) => r.kcal_gastas);
  const sleep = toSeries(rows, (r) => r.sono_min, (v) => +(v / 60).toFixed(1));
  const hr = toSeries(rows, (r) => r.fc_media);
  const hrv = toSeries(rows, (r) => r.hrv);

  const s = {
    ...p.s,
    ...(steps.length ? { steps } : {}),
    ...(calories.length ? { calories } : {}),
    ...(sleep.length ? { sleep } : {}),
    ...(hr.length ? { hr } : {}),
    ...(hrv.length ? { hrv } : {}),
  };

  const last = rows[rows.length - 1]!;
  const lastSync = new Date(last.data + 'T00:00:00');
  const syncHours = Math.max(
    0,
    Math.round((Date.now() - lastSync.getTime()) / 3_600_000),
  );

  return {
    ...p,
    s,
    hasData: true,
    lastSync: last.data,
    steps: steps.length ? Math.round(avgLast(steps, 7)) : p.steps,
    calories: calories.length
      ? Math.round(avgLast(calories, 7) * 7)
      : p.calories,
    sleep: sleep.length ? +avgLast(sleep, 7).toFixed(1) : p.sleep,
    restingHr: hr.length ? Math.round(avgLast(hr, 7)) : p.restingHr,
    hrv: hrv.length ? Math.round(avgLast(hrv, 7)) : p.hrv,
    syncHours,
  };
}

// ----- Medições (peso real) ---------------------------------------------------

export interface MeasurementRow {
  data: string;
  peso_kg: number | null;
  imc: number | null;
}

export async function loadMeasurements(id: string): Promise<MeasurementRow[]> {
  try {
    const rows = await apiFetch<MeasurementRow[]>(`/patients/${id}/measurements`);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export interface NewMeasurement {
  data: string;
  pesoKg?: number;
  percentualGordura?: number;
  circCintura?: number;
  obs?: string;
}

/** Registra uma nova medição; true em caso de sucesso. */
export async function createMeasurement(
  id: string,
  m: NewMeasurement,
): Promise<boolean> {
  try {
    await apiFetch(`/patients/${id}/measurements`, {
      method: 'POST',
      body: JSON.stringify(m),
    });
    return true;
  } catch {
    return false;
  }
}

/** Sobrepõe a série de peso com medições reais quando existem. */
export function applyRealWeight(p: Patient, rows: MeasurementRow[]): Patient {
  const w = rows
    .filter((r) => r.peso_kg != null)
    .map((r) => {
      const d = new Date(r.data + 'T00:00:00');
      return { date: r.data, day: d.getDay(), value: r.peso_kg as number };
    });
  if (w.length === 0) return p;
  return { ...p, s: { ...p.s, weight: w }, weight: w[w.length - 1]!.value };
}

// ----- Metas (patient_goals) --------------------------------------------------

export interface PatientGoals {
  meta_passos: number | null;
  meta_kcal: number | null;
  meta_treinos: number | null;
  meta_min_ativos: number | null;
  meta_sono_h: number | null;
  meta_peso_kg: number | null;
  updated_at?: string;
}

export interface GoalsInput {
  metaPassos?: number;
  metaKcal?: number;
  metaTreinos?: number;
  metaMinAtivos?: number;
  metaSonoH?: number;
  metaPesoKg?: number;
}

/** Carrega as metas prescritas; null se não houver/indisponível. */
export async function loadGoals(id: string): Promise<PatientGoals | null> {
  try {
    return await apiFetch<PatientGoals | null>(`/patients/${id}/goals`);
  } catch {
    return null;
  }
}

/** Persiste as metas; true em caso de sucesso. */
export async function saveGoals(
  id: string,
  goals: GoalsInput,
): Promise<boolean> {
  try {
    await apiFetch(`/patients/${id}/goals`, {
      method: 'PUT',
      body: JSON.stringify(goals),
    });
    return true;
  } catch {
    return false;
  }
}
