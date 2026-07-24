/* IC Clínica — Ranking de resultados (perda de peso, massa magra, InBody). */
import { apiFetch } from './api';

export interface RankingItem {
  patient_id: string;
  nome: string;
  sexo: string | null;
  eh_funcionario: boolean;
  perda_peso_kg: number | null;
  ganho_massa_magra_kg: number | null;
  delta_pontuacao_inbody: number | null;
  score: number | null;
  tem_dados: boolean;
}

export interface RankingResult {
  pesos: { perdaPeso: number; ganhoMassaMagra: number; pontuacaoInbody: number };
  from: string;
  to: string;
  itens: RankingItem[];
}

export type Publico = 'pacientes' | 'funcionarios';
export type Genero = 'F' | 'M' | 'outro';

export interface RankingFilters {
  days?: number; // 30 | 60 | 90 | 120 | 365
  from?: string;
  to?: string;
  publicos: Publico[];
  generos: Genero[];
}

export async function loadRanking(f: RankingFilters): Promise<RankingResult | null> {
  const qs = new URLSearchParams();
  if (f.from && f.to) {
    qs.set('from', f.from);
    qs.set('to', f.to);
  } else if (f.days) {
    qs.set('days', String(f.days));
  }
  if (f.publicos.length) qs.set('publicos', f.publicos.join(','));
  if (f.generos.length) qs.set('generos', f.generos.join(','));
  try {
    return await apiFetch<RankingResult>(`/patients/ranking?${qs.toString()}`);
  } catch {
    return null;
  }
}
