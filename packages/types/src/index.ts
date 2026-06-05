/**
 * Tipos de domínio compartilhados entre frontend (Next.js) e backend (NestJS).
 * Mantém o contrato único da plataforma IC.
 */

export type UserRole = 'admin' | 'medico' | 'nutri' | 'recepcao' | 'paciente';

export type Sexo = 'F' | 'M' | 'outro';

export interface Patient {
  id: string;
  clinicId: string;
  userId: string;
  nome: string;
  dataNasc: string | null;
  sexo: Sexo | null;
  alturaCm: number | null;
  objetivo: string | null;
  ativo: boolean;
}

export interface Measurement {
  id: string;
  patientId: string;
  data: string;
  pesoKg: number | null;
  imc: number | null;
  percentualGordura: number | null;
  circCintura: number | null;
}

export type WearableProvider =
  | 'GARMIN'
  | 'APPLE'
  | 'SAMSUNG'
  | 'POLAR'
  | 'WHOOP'
  | 'OURA'
  | 'FITBIT'
  | 'GOOGLE';

export interface WearableDaily {
  id: string;
  patientId: string;
  data: string;
  passos: number | null;
  kcalGastas: number | null;
  fcMedia: number | null;
  fcMax: number | null;
  sonoMin: number | null;
  hrv: number | null;
  minutosAtivos: number | null;
}

export type AlertType =
  | 'queda_atividade'
  | 'excesso_carga'
  | 'abaixo_meta'
  | 'sem_dados';

export type AlertStatus = 'aberto' | 'visto' | 'resolvido';

export interface Alert {
  id: string;
  clinicId: string;
  patientId: string;
  tipo: AlertType;
  severidade: 'baixa' | 'media' | 'alta';
  mensagem: string;
  status: AlertStatus;
  data: string;
}

/** Resultado da estimativa de calorias por IA a partir da foto da refeição. */
export interface MealAiEstimate {
  itens: Array<{
    alimento: string;
    porcaoEstimada: string;
    kcal: number;
    confianca: number; // 0..1
  }>;
  kcalTotal: number;
  confiancaGeral: number; // 0..1
}
