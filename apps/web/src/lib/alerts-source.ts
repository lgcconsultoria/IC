/* IC Clínica — Alertas: API real (com nome do paciente) ou demo. */
import { apiFetch } from './api';
import { apiPatient, type AlertItem, type AlertLevel, type Patient } from './clinic-data';

interface ApiAlert {
  id: string;
  patient_id: string;
  tipo: string;
  severidade: string;
  mensagem: string;
  status: string;
  data: string;
  paciente_nome: string;
}

const LABEL: Record<string, { title: string; metric: string; action: string }> = {
  queda_atividade: {
    title: 'Queda de atividade',
    metric: 'Atividade',
    action: 'Enviar mensagem de retomada e revisar o plano de treino.',
  },
  excesso_carga: {
    title: 'Sinais de sobrecarga (HRV baixo)',
    metric: 'HRV',
    action: 'Reduzir intensidade por alguns dias e priorizar recuperação.',
  },
  abaixo_meta: {
    title: 'Aderência abaixo da meta',
    metric: 'Aderência',
    action: 'Ajustar metas e reforçar o acompanhamento ativo.',
  },
  sem_dados: {
    title: 'Sem sincronização do wearable',
    metric: 'Sincronização',
    action: 'Pedir ao paciente para abrir o app do dispositivo.',
  },
};

function ago(h: number): string {
  if (h < 1) return 'agora há pouco';
  if (h < 24) return `há ${h}h`;
  return `há ${Math.round(h / 24)}d`;
}

function levelOf(sev: string): AlertLevel {
  return sev === 'alta' ? 'crit' : sev === 'media' ? 'warn' : 'info';
}

export interface AlertWithPatient {
  item: AlertItem;
  patient: Patient;
}

function mapAlert(a: ApiAlert): AlertWithPatient {
  const l = LABEL[a.tipo] ?? { title: a.tipo, metric: '', action: '' };
  const hours = Math.max(
    0,
    Math.round((Date.now() - new Date(a.data).getTime()) / 3_600_000),
  );
  const item: AlertItem = {
    id: a.id,
    level: levelOf(a.severidade),
    patient: a.patient_id,
    title: l.title,
    desc: a.mensagem,
    metric: l.metric,
    action: l.action,
    hours,
    status: a.status === 'resolvido' ? 'resolved' : 'open',
    agoLabel: ago(hours),
  };
  return { item, patient: apiPatient({ id: a.patient_id, name: a.paciente_nome }) };
}

/** Carrega os alertas reais; null se indisponível (cai para demo na UI). */
export async function loadAlerts(): Promise<AlertWithPatient[] | null> {
  try {
    const rows = await apiFetch<ApiAlert[]>('/alerts');
    if (!Array.isArray(rows)) return null;
    return rows.map(mapAlert);
  } catch {
    return null;
  }
}

/** Alertas de um paciente específico (para o perfil); null se indisponível. */
export async function loadPatientAlerts(id: string): Promise<AlertItem[] | null> {
  try {
    const rows = await apiFetch<ApiAlert[]>(`/alerts/patient/${id}`);
    if (!Array.isArray(rows)) return null;
    return rows.map((a) => mapAlert(a).item);
  } catch {
    return null;
  }
}

export async function resolveAlert(id: string): Promise<boolean> {
  try {
    await apiFetch(`/alerts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'resolvido' }),
    });
    return true;
  } catch {
    return false;
  }
}

/** Dispara a geração de alertas por regras no backend. */
export async function refreshAlerts(): Promise<boolean> {
  try {
    await apiFetch('/alerts/refresh', { method: 'POST' });
    return true;
  } catch {
    return false;
  }
}
