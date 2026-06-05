/* IC Clínica — Fonte de pacientes: tenta a API real, cai para demo. */
import { apiFetch } from './api';
import { DATA, synthPatient, byId, type Patient, type ApiPatientLike } from './clinic-data';

interface ApiPatientRow {
  id: string;
  user_id?: string;
  objetivo: string | null;
  ativo: boolean;
  created_at?: string;
  nome?: { nome: string } | { nome: string }[] | null;
}

export type DataSource = 'api' | 'demo';

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

/** Lista de pacientes para o painel: API real quando disponível, senão demo. */
export async function loadClinicPatients(): Promise<PatientsResult> {
  try {
    const rows = await apiFetch<ApiPatientRow[]>('/patients');
    if (Array.isArray(rows) && rows.length > 0) {
      return { patients: rows.map((r) => synthPatient(toApiLike(r))), source: 'api' };
    }
  } catch {
    /* sem sessão / API indisponível / DB vazio → demo */
  }
  return { patients: DATA.patients, source: 'demo' };
}

/** Um paciente pelo id: demo (p1..p15) ou busca na API e sintetiza o view-model. */
export async function loadPatient(id: string): Promise<Patient | null> {
  const demo = byId(id);
  if (demo) return demo;
  try {
    const row = await apiFetch<ApiPatientRow & { altura_cm?: number | null; sexo?: 'F' | 'M' | 'outro' | null }>(`/patients/${id}`);
    if (row && row.id) {
      return synthPatient({
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
