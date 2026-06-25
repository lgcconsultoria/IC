/* ============================================================
   IC Clínica — Camada de dados (formato Terra API, realista)
   Portado do protótipo (data.js) para TypeScript tipado.
   Serve como dados de demonstração enquanto o backend ainda não
   expõe endpoints de leitura de wearables/alertas/aderência.
   ============================================================ */

export type DeviceKey =
  | 'garmin'
  | 'apple'
  | 'samsung'
  | 'fitbit'
  | 'oura'
  | 'whoop'
  | 'polar'
  | 'strava'
  | 'google';

export interface DeviceInfo {
  name: string;
  mono: string;
  color: string;
}

export type Perf = 'high' | 'mid' | 'low';
export type Priority = 'l' | 'm' | 'h';
export type AlertLevel = 'crit' | 'warn' | 'info';
export type AlertStatusState = 'open' | 'resolved';

export interface SeriesPoint {
  date: string;
  day: number;
  value: number;
}

export interface PatientSeries {
  steps: SeriesPoint[];
  calories: SeriesPoint[];
  sleep: SeriesPoint[];
  hr: SeriesPoint[];
  hrv: SeriesPoint[];
  weight: SeriesPoint[];
}

export interface Patient {
  id: string;
  name: string;
  initials: string;
  sex: 'f' | 'm';
  age: number;
  device: DeviceKey;
  color: string;
  syncHours: number;
  adherence: number;
  perf: Perf;
  priority: Priority;
  alertCount: number;
  steps: number;
  calories: number;
  workouts: number;
  sleep: number;
  restingHr: number;
  hrv: number;
  weight: number;
  heightCm: number;
  goalSteps: number;
  goalCal: number;
  goalWorkouts: number;
  goalSleep: number;
  goalActiveMin: number;
  tags: string[];
  s: PatientSeries;
  /** true somente quando há dados REAIS de wearable sobrepostos. */
  hasData: boolean;
  /** Data ISO (YYYY-MM-DD) da última sincronização real; null se nunca. */
  lastSync: string | null;
}

/**
 * Modo demonstração. Quando ligado (NEXT_PUBLIC_DEMO=1), o painel usa o
 * dataset fictício e métricas sintéticas — útil para apresentações comerciais.
 * DESLIGADO por padrão: o cliente real vê apenas dados reais + estados vazios.
 */
export const DEMO = process.env.NEXT_PUBLIC_DEMO === '1';

export interface AlertItem {
  id: string;
  level: AlertLevel;
  patient: string;
  title: string;
  desc: string;
  metric: string;
  action: string;
  hours: number;
  status: AlertStatusState;
  agoLabel: string;
}

export interface TimelineItem {
  t: string;
  type: 'sync' | 'workout' | 'goal' | 'sleep' | 'note' | 'alert';
  icon: string;
  title: string;
  desc: string;
}

export interface AdherenceSegment {
  label: string;
  value: number;
  color: string;
}

// tiny seeded RNG so charts are stable across renders
function mulberry(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// build a series of `n` days ending today, around base with noise + trend
function series(
  seed: number,
  n: number,
  base: number,
  spread: number,
  trend?: number,
): SeriesPoint[] {
  const rnd = mulberry(seed);
  const out: SeriesPoint[] = [];
  const today = new Date('2026-06-05T00:00:00');
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const t = (n - 1 - i) / Math.max(1, n - 1);
    const wknd = d.getDay() === 0 || d.getDay() === 6 ? -0.18 : 0;
    const v =
      base * (1 + (trend || 0) * (t - 0.5)) +
      (rnd() - 0.5) * 2 * spread +
      base * wknd;
    out.push({
      date: d.toISOString().slice(0, 10),
      day: d.getDay(),
      value: Math.max(0, Math.round(v)),
    });
  }
  return out;
}

export const DEVICES: Record<DeviceKey, DeviceInfo> = {
  garmin: { name: 'Garmin', mono: 'G', color: '#0a78c2' },
  apple: { name: 'Apple Health', mono: '', color: '#1d1d1f' },
  samsung: { name: 'Samsung Health', mono: 'S', color: '#1428a0' },
  fitbit: { name: 'Fitbit', mono: 'F', color: '#00b0b9' },
  oura: { name: 'Oura', mono: 'O', color: '#3a3a3c' },
  whoop: { name: 'WHOOP', mono: 'W', color: '#0b0b0b' },
  polar: { name: 'Polar', mono: 'P', color: '#d4123c' },
  strava: { name: 'Strava', mono: '', color: '#fc4c02' },
  google: { name: 'Google Fit', mono: 'G', color: '#34a853' },
};

const AVCOL = [
  '#2f7d5c',
  '#3a6ea5',
  '#a9603a',
  '#7a5ea8',
  '#b03a5b',
  '#2f8a8a',
  '#9a7d1f',
  '#5a6b2f',
];

type PRow = [
  string,
  string,
  'f' | 'm',
  number,
  DeviceKey,
  number,
  number,
  Perf,
  number,
  number,
  number,
  number,
  number,
  number,
  Priority,
  number,
];

const P: PRow[] = [
  ['Helena Marques', 'HM', 'f', 42, 'garmin', 12, 91, 'high', 9240, 4280, 5, 7.4, 58, 64, 'm', 0],
  ['Rafael Tavares', 'RT', 'm', 55, 'apple', 48, 47, 'low', 4120, 2110, 1, 5.9, 71, 38, 'h', 2],
  ['Beatriz Coelho', 'BC', 'f', 31, 'whoop', 3, 88, 'high', 11200, 5010, 6, 7.9, 54, 72, 'm', 0],
  ['Otávio Lima', 'OL', 'm', 38, 'fitbit', 26, 62, 'mid', 6850, 3120, 3, 6.6, 63, 51, 'm', 1],
  ['Sônia Albuquerque', 'SA', 'f', 67, 'samsung', 96, 29, 'low', 2980, 1340, 0, 6.1, 76, 31, 'h', 3],
  ['Diego Fontes', 'DF', 'm', 29, 'strava', 6, 79, 'high', 9870, 4560, 4, 6.8, 56, 66, 'l', 0],
  ['Larissa Nunes', 'LN', 'f', 45, 'oura', 18, 71, 'mid', 7240, 2890, 2, 7.1, 60, 55, 'm', 1],
  ['Marcos Pereira', 'MP', 'm', 61, 'polar', 72, 41, 'low', 3760, 1880, 1, 5.4, 69, 35, 'h', 2],
  ['Yara Botelho', 'YB', 'f', 34, 'garmin', 9, 84, 'high', 10350, 4720, 5, 7.6, 57, 68, 'l', 0],
  ['Caio Ribeiro', 'CR', 'm', 48, 'apple', 30, 58, 'mid', 5980, 2640, 2, 6.3, 66, 48, 'm', 1],
  ['Vivian Castro', 'VC', 'f', 52, 'google', 120, 33, 'low', 2410, 1190, 0, 5.7, 72, 29, 'h', 2],
  ['Bruno Azevedo', 'BA', 'm', 27, 'whoop', 2, 93, 'high', 12640, 5380, 6, 8.1, 51, 78, 'l', 0],
  ['Tânia Rocha', 'TR', 'f', 59, 'fitbit', 54, 52, 'mid', 4890, 2230, 1, 6.0, 70, 42, 'm', 1],
  ['Felipe Andrade', 'FA', 'm', 41, 'samsung', 15, 76, 'high', 8420, 3680, 4, 7.2, 59, 61, 'l', 0],
  ['Renata Vasques', 'RV', 'f', 36, 'oura', 21, 68, 'mid', 6720, 2980, 3, 7.0, 61, 53, 'm', 0],
];

const WEIGHTS = [88, 72, 61, 94, 68, 79, 65, 86, 58, 90, 74, 82, 70, 88, 63];
const HEIGHTS = [165, 178, 168, 182, 160, 176, 170, 180, 172, 179, 163, 184, 166, 177, 169];

export const patients: Patient[] = P.map((p, i) => {
  const [name, init, sex, age, device, syncH, adh, perf, steps, cal, workouts, sleep, rhr, hrv, prio, alerts] = p;
  const id = 'p' + (i + 1);
  const seed = (i + 1) * 1117;
  return {
    id,
    name,
    initials: init,
    sex,
    age,
    device,
    color: AVCOL[i % AVCOL.length] as string,
    syncHours: syncH,
    adherence: adh,
    perf,
    priority: prio,
    alertCount: alerts,
    steps,
    calories: cal,
    workouts,
    sleep,
    restingHr: rhr,
    hrv,
    weight: WEIGHTS[i] as number,
    heightCm: HEIGHTS[i] as number,
    goalSteps: 10000,
    goalCal: 4500,
    goalWorkouts: 5,
    goalSleep: 7.5,
    goalActiveMin: 30,
    tags: [
      adh < 50 ? 'baixa-aderencia' : null,
      steps < 5000 ? 'baixa-atividade' : null,
      workouts === 0 ? 'sem-treino' : null,
      sleep < 6.2 ? 'sono-ruim' : null,
      syncH > 48 ? 'sem-sync' : null,
      adh >= 85 ? 'alta-performance' : null,
      steps < 10000 ? 'meta-nao-atingida' : null,
    ].filter((x): x is string => Boolean(x)),
    s: {
      steps: series(seed + 1, 14, steps, steps * 0.22, adh > 70 ? 0.15 : -0.12),
      calories: series(seed + 2, 14, cal, cal * 0.2, adh > 70 ? 0.12 : -0.1),
      sleep: series(seed + 3, 14, sleep * 60, 45, 0.04).map((d) => ({
        ...d,
        value: +(d.value / 60).toFixed(1),
      })),
      hr: series(seed + 4, 14, rhr, 5, adh > 70 ? -0.06 : 0.05),
      hrv: series(seed + 5, 14, hrv, 8, adh > 70 ? 0.1 : -0.08),
      weight: series(seed + 6, 30, (WEIGHTS[i] as number) * 10, 6, adh > 70 ? -0.03 : 0.01).map((d) => ({
        ...d,
        value: +(d.value / 10).toFixed(1),
      })),
    },
    hasData: true,
    lastSync: new Date(Date.now() - syncH * 3_600_000).toISOString().slice(0, 10),
  };
});

function ago(h: number): string {
  if (h < 1) return 'agora há pouco';
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  return `há ${d}d`;
}

export const alerts: AlertItem[] = (
  [
    { id: 'a1', level: 'crit', patient: 'p2', title: 'Frequência cardíaca de repouso elevada', desc: 'FC repouso subiu para 71 bpm (+9 vs. base de 14 dias). Possível estresse ou sobretreino.', metric: 'FC repouso', action: 'Revisar carga de treino e qualidade do sono na próxima consulta.', hours: 3, status: 'open' },
    { id: 'a2', level: 'crit', patient: 'p5', title: 'Sem sincronização há 4 dias', desc: 'Samsung Health não envia dados desde 01/06. Paciente pode ter perdido a conexão.', metric: 'Sincronização', action: 'Enviar lembrete de reconexão do wearable ao paciente.', hours: 6, status: 'open' },
    { id: 'a3', level: 'crit', patient: 'p11', title: 'Aderência crítica (33%)', desc: 'Queda contínua de atividade nas últimas 3 semanas. 0 treinos registrados.', metric: 'Aderência', action: 'Agendar contato ativo e revisar metas — possivelmente ambiciosas demais.', hours: 9, status: 'open' },
    { id: 'a4', level: 'warn', patient: 'p8', title: 'Qualidade de sono em queda', desc: 'Média de sono caiu para 5.4h/noite na última semana (meta 7.5h).', metric: 'Sono', action: 'Orientar higiene do sono; investigar fatores comportamentais.', hours: 14, status: 'open' },
    { id: 'a5', level: 'warn', patient: 'p4', title: 'Meta de passos não atingida', desc: '5 de 7 dias abaixo de 7.000 passos. Tendência levemente negativa.', metric: 'Passos', action: 'Sugerir caminhadas curtas pós-refeição; ajustar meta intermediária.', hours: 20, status: 'open' },
    { id: 'a6', level: 'warn', patient: 'p13', title: 'HRV abaixo do baseline', desc: 'HRV médio 42ms, abaixo da faixa individual habitual (50–60ms).', metric: 'HRV', action: 'Reduzir intensidade dos treinos por 3–5 dias e reavaliar.', hours: 28, status: 'open' },
    { id: 'a7', level: 'info', patient: 'p1', title: 'Meta semanal atingida 🎉', desc: 'Helena bateu 5 treinos e 9.2k passos/dia. Ótimo momento para reforço positivo.', metric: 'Aderência', action: 'Enviar mensagem de reconhecimento; considerar progredir metas.', hours: 30, status: 'open' },
    { id: 'a8', level: 'info', patient: 'p12', title: 'Recuperação ótima detectada', desc: 'WHOOP indica recuperação 92% — janela ideal para treino de alta intensidade.', metric: 'Recuperação', action: 'Comunicar paciente sobre a janela de performance.', hours: 36, status: 'open' },
    { id: 'a9', level: 'warn', patient: 'p10', title: 'Calorias ativas abaixo da meta', desc: '2.640 kcal/sem vs. meta 4.500. Plateau nas últimas 2 semanas.', metric: 'Calorias', action: 'Incluir 1 sessão extra de cardio leve; revisar gasto basal.', hours: 44, status: 'resolved' },
    { id: 'a10', level: 'info', patient: 'p9', title: 'Tendência de peso favorável', desc: 'Yara: −0.9kg em 30 dias mantendo massa de atividade. Progresso consistente.', metric: 'Peso', action: 'Validar com bioimpedância na próxima visita.', hours: 50, status: 'resolved' },
  ] as Omit<AlertItem, 'agoLabel'>[]
).map((a) => ({ ...a, agoLabel: ago(a.hours) }));

export function byId(id: string): Patient | undefined {
  return patients.find((p) => p.id === id);
}

export function fmt(n: number): string {
  return n.toLocaleString('pt-BR');
}

export function timelineFor(p: Patient): TimelineItem[] {
  return [
    { t: 'há 2h', type: 'sync', icon: 'sync', title: `Sincronização ${DEVICES[p.device].name}`, desc: `${fmt(p.steps)} passos · ${p.calories} kcal ativas` },
    { t: 'ontem', type: 'workout', icon: 'activity', title: 'Treino registrado', desc: p.workouts > 0 ? 'Corrida 42min · 412 kcal · FC média 148' : 'Nenhum treino — dia de descanso' },
    { t: 'há 2d', type: 'goal', icon: 'target', title: p.adherence >= 80 ? 'Meta diária de passos atingida' : 'Meta diária não atingida', desc: `${fmt(p.steps)} de ${fmt(p.goalSteps)} passos` },
    { t: 'há 3d', type: 'sleep', icon: 'moon', title: 'Registro de sono', desc: `${p.sleep}h · ${p.sleep >= 7 ? 'qualidade boa' : 'qualidade abaixo do ideal'}` },
    { t: 'há 5d', type: 'note', icon: 'note', title: 'Anotação clínica', desc: 'Consulta de retorno — ajuste de plano alimentar e meta de hidratação.' },
    { t: 'há 7d', type: 'alert', icon: 'bell', title: 'Alerta gerado', desc: p.perf === 'low' ? 'Aderência abaixo de 50%' : 'HRV recuperando ao baseline' },
  ];
}

export const clinic = {
  name: 'IC Clínica',
  totalPatients: patients.length,
  activePatients: patients.filter((p) => p.syncHours <= 48).length,
  noSync: patients.filter((p) => p.syncHours > 48).length,
  lowAdherence: patients.filter((p) => p.adherence < 50).length,
  critAlerts: alerts.filter((a) => a.level === 'crit' && a.status === 'open').length,
  weeklyEvolution: 6.4,
};

// aggregate clinic-wide weekly series
function agg(key: keyof PatientSeries, mul?: number): SeriesPoint[] {
  const base = series(99, 14, 100, 8, 0.05);
  return base.map((d, idx) => {
    let sum = 0;
    patients.forEach((p) => {
      sum += p.s[key] && p.s[key][idx] ? (p.s[key][idx] as SeriesPoint).value : 0;
    });
    return { date: d.date, day: d.day, value: Math.round((sum / patients.length) * (mul || 1)) };
  });
}

export const aggregates = {
  steps: agg('steps'),
  calories: agg('calories'),
  sleep: agg('sleep'),
};

export const adherenceDist: AdherenceSegment[] = [
  { label: 'Alta · 80–100', value: patients.filter((p) => p.adherence >= 80).length, color: 'var(--good)' },
  { label: 'Média · 50–79', value: patients.filter((p) => p.adherence >= 50 && p.adherence < 80).length, color: 'var(--warn)' },
  { label: 'Baixa · 0–49', value: patients.filter((p) => p.adherence < 50).length, color: 'var(--crit)' },
];

export const DATA = {
  clinic,
  patients,
  alerts,
  timelineFor,
  agg: aggregates,
  adherenceDist,
};

// ----- View-models de paciente ---------------------------------------------
// `apiPatient` cria um view-model HONESTO a partir do registro real: só a
// identidade é preenchida; métricas ficam vazias (hasData=false) até existir
// sincronização real de wearable, quando `applyRealWearables` as sobrepõe.
// `demoPatient` mantém a fabricação determinística APENAS para o modo demo
// (NEXT_PUBLIC_DEMO=1), usado em apresentações comerciais.

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export interface ApiPatientLike {
  id: string;
  name: string;
  objetivo?: string | null;
  sexo?: 'F' | 'M' | 'outro' | null;
  alturaCm?: number | null;
  age?: number | null;
}

const DEVICE_KEYS = Object.keys(DEVICES) as DeviceKey[];

/**
 * View-model honesto de um paciente real: identidade preenchida, métricas
 * zeradas e séries vazias. `hasData=false` sinaliza à UI para mostrar estados
 * vazios em vez de números. As séries reais entram via `applyRealWearables`.
 */
export function apiPatient(input: ApiPatientLike): Patient {
  const seed = hashStr(input.id) || 1;
  const sex: 'f' | 'm' = input.sexo === 'M' ? 'm' : input.sexo === 'F' ? 'f' : 'f';
  const empty: SeriesPoint[] = [];
  return {
    id: input.id,
    name: input.name,
    initials: initialsOf(input.name),
    sex,
    age: input.age ?? 0,
    device: DEVICE_KEYS[seed % DEVICE_KEYS.length] as DeviceKey,
    color: AVCOL[seed % AVCOL.length] as string,
    syncHours: Number.MAX_SAFE_INTEGER,
    adherence: 0,
    perf: 'mid',
    priority: 'm',
    alertCount: 0,
    steps: 0,
    calories: 0,
    workouts: 0,
    sleep: 0,
    restingHr: 0,
    hrv: 0,
    weight: 0,
    heightCm: input.alturaCm ?? 0,
    goalSteps: 10000,
    goalCal: 4500,
    goalWorkouts: 5,
    goalSleep: 7.5,
    goalActiveMin: 30,
    tags: [],
    s: { steps: empty, calories: empty, sleep: empty, hr: empty, hrv: empty, weight: empty },
    hasData: false,
    lastSync: null,
  };
}

export function demoPatient(input: ApiPatientLike): Patient {
  const seed = hashStr(input.id) || 1;
  const rnd = mulberry(seed);
  const device = DEVICE_KEYS[seed % DEVICE_KEYS.length] as DeviceKey;
  const adherence = Math.round(28 + rnd() * 66);
  const perf: Perf = adherence >= 80 ? 'high' : adherence >= 50 ? 'mid' : 'low';
  const steps = Math.round(2500 + rnd() * 10000);
  const cal = Math.round(1200 + rnd() * 4200);
  const workouts = Math.round(rnd() * 6);
  const sleep = +(5.2 + rnd() * 3).toFixed(1);
  const rhr = Math.round(50 + rnd() * 28);
  const hrv = Math.round(28 + rnd() * 52);
  const syncH = Math.round(rnd() * 130);
  const weight = +(58 + rnd() * 40).toFixed(0);
  const heightCm = input.alturaCm ?? Math.round(158 + rnd() * 28);
  const sex: 'f' | 'm' = input.sexo === 'M' ? 'm' : input.sexo === 'F' ? 'f' : rnd() > 0.5 ? 'f' : 'm';
  const tags = [
    adherence < 50 ? 'baixa-aderencia' : null,
    steps < 5000 ? 'baixa-atividade' : null,
    workouts === 0 ? 'sem-treino' : null,
    sleep < 6.2 ? 'sono-ruim' : null,
    syncH > 48 ? 'sem-sync' : null,
    adherence >= 85 ? 'alta-performance' : null,
    steps < 10000 ? 'meta-nao-atingida' : null,
  ].filter((x): x is string => Boolean(x));

  return {
    id: input.id,
    name: input.name,
    initials: initialsOf(input.name),
    sex,
    age: input.age ?? Math.round(28 + rnd() * 40),
    device,
    color: AVCOL[seed % AVCOL.length] as string,
    syncHours: syncH,
    adherence,
    perf,
    priority: adherence < 50 ? 'h' : adherence < 80 ? 'm' : 'l',
    alertCount: adherence < 50 ? 2 : adherence < 70 ? 1 : 0,
    steps,
    calories: cal,
    workouts,
    sleep,
    restingHr: rhr,
    hrv,
    weight,
    heightCm,
    goalSteps: 10000,
    goalCal: 4500,
    goalWorkouts: 5,
    goalSleep: 7.5,
    goalActiveMin: 30,
    tags,
    s: {
      steps: series(seed + 1, 14, steps, steps * 0.22, adherence > 70 ? 0.15 : -0.12),
      calories: series(seed + 2, 14, cal, cal * 0.2, adherence > 70 ? 0.12 : -0.1),
      sleep: series(seed + 3, 14, sleep * 60, 45, 0.04).map((d) => ({ ...d, value: +(d.value / 60).toFixed(1) })),
      hr: series(seed + 4, 14, rhr, 5, adherence > 70 ? -0.06 : 0.05),
      hrv: series(seed + 5, 14, hrv, 8, adherence > 70 ? 0.1 : -0.08),
      weight: series(seed + 6, 30, weight * 10, 6, adherence > 70 ? -0.03 : 0.01).map((d) => ({ ...d, value: +(d.value / 10).toFixed(1) })),
    },
    hasData: true,
    lastSync: new Date(Date.now() - syncH * 3_600_000).toISOString().slice(0, 10),
  };
}
