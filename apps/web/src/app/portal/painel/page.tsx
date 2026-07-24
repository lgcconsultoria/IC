'use client';
/* IC Clínica — Dashboard DO PACIENTE: os dados do Garmin dele + evolução.
   (Separado do painel da clínica, que mostra dados de todos os pacientes.) */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons';
import { LineChart, BarChart } from '@/components/charts';
import { apiFetch } from '@/lib/api';
import { getSupabase } from '@/lib/supabase';
import {
  loadMe,
  loadPatientWearables,
  loadPatientActivities,
  type WearableDailyRow,
  type WearableActivityRow,
} from '@/lib/patient-source';

type ConnStatus = 'pending' | 'active' | 'reauth_required' | 'disconnected' | 'error';
interface Series { date: string; day: number; value: number }

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function monthKey(iso: string): string { return iso.slice(0, 7); }
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MONTHS_PT[Number(m) - 1]}/${y.slice(2)}`;
}
function lastMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const dd = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}
const fmt = (n: number) => n.toLocaleString('pt-BR');
function dur(inicio: string, fim: string | null): string {
  if (!fim) return '—';
  const ms = new Date(fim).getTime() - new Date(inicio).getTime();
  if (!(ms > 0)) return '—';
  const min = Math.round(ms / 60000);
  return min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min} min`;
}

export default function PatientDashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [status, setStatus] = useState<ConnStatus>('disconnected');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [daily, setDaily] = useState<WearableDailyRow[]>([]);
  const [acts, setActs] = useState<WearableActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pid, setPid] = useState<string | null>(null);

  async function loadData(id: string) {
    const [d, a] = await Promise.all([
      loadPatientWearables(id, 180),
      loadPatientActivities(id, 180),
    ]);
    setDaily(d);
    setActs(a);
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await getSupabase().auth.getUser();
      if (!user) { router.push('/portal/login'); return; }
      if (user.email) setUserName(user.email.split('@')[0]);

      const me = await loadMe();
      try {
        const s = await apiFetch<{ status: ConnStatus; lastSyncAt: string | null }>('/garmin/status');
        setStatus(s.status);
        setLastSync(s.lastSyncAt);
      } catch { /* ignore */ }

      if (me) {
        setPid(me.id);
        await loadData(me.id);
      }
      setLoading(false);

      // Reconexão automática: com a URL MCP salva no perfil, dispara um refresh
      // em segundo plano ao abrir e recarrega os dados quando terminar.
      if (me) {
        apiFetch('/garmin/sync', { method: 'POST' })
          .then(async () => {
            await loadData(me.id);
            try {
              const s2 = await apiFetch<{ status: ConnStatus; lastSyncAt: string | null }>('/garmin/status');
              setStatus(s2.status); setLastSync(s2.lastSyncAt);
            } catch { /* ignore */ }
          })
          .catch(() => { /* poller cuida do resto */ });
      }
    }
    init();
  }, [router]);

  const summary = useMemo(() => {
    const kcal = acts.reduce((s, a) => s + (a.kcal ?? 0), 0);
    const dist = acts.reduce((s, a) => s + (a.distancia_m ?? 0), 0);
    const hrVals = acts.map((a) => a.fc_media).filter((v): v is number => v != null);
    const sleepVals = daily.map((d) => d.sono_min).filter((v): v is number => v != null);
    const hrvVals = daily.map((d) => d.hrv).filter((v): v is number => v != null);
    const avg = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
    return {
      workouts: acts.length,
      kcal,
      distKm: dist / 1000,
      avgHr: Math.round(avg(hrVals)),
      avgSleepH: +(avg(sleepVals) / 60).toFixed(1),
      avgHrv: Math.round(avg(hrvVals)),
      hasSleep: sleepVals.length > 0,
      hasHrv: hrvVals.length > 0,
    };
  }, [acts, daily]);

  const charts = useMemo(() => {
    const months = lastMonths(6);
    const idx = new Map(months.map((m, i) => [m, i]));
    const workouts = months.map((m) => ({ date: `${m}-01`, day: 0, value: 0 })) as Series[];
    const kcal = months.map((m) => ({ date: `${m}-01`, day: 0, value: 0 })) as Series[];
    for (const a of acts) {
      const i = idx.get(monthKey(a.inicio));
      if (i == null) continue;
      workouts[i].value += 1;
      kcal[i].value += a.kcal ?? 0;
    }
    // médias mensais de sono/HRV
    const sSum = months.map(() => 0), sN = months.map(() => 0);
    const hSum = months.map(() => 0), hN = months.map(() => 0);
    for (const d of daily) {
      const i = idx.get(monthKey(d.data));
      if (i == null) continue;
      if (d.sono_min != null) { sSum[i] += d.sono_min; sN[i] += 1; }
      if (d.hrv != null) { hSum[i] += d.hrv; hN[i] += 1; }
    }
    const sleep = months.map((m, i) => ({ date: `${m}-01`, day: 0, value: sN[i] ? +((sSum[i] / sN[i]) / 60).toFixed(1) : 0 })) as Series[];
    const hrv = months.map((m, i) => ({ date: `${m}-01`, day: 0, value: hN[i] ? Math.round(hSum[i] / hN[i]) : 0 })) as Series[];
    return { months, workouts, kcal, sleep, hrv };
  }, [acts, daily]);

  const recent = useMemo(
    () => [...acts].sort((a, b) => b.inicio.localeCompare(a.inicio)).slice(0, 12),
    [acts],
  );

  const connected = status === 'active';
  const hasData = acts.length > 0 || daily.length > 0;

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg)' }}>
      <div className="between" style={{ padding: '16px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div className="row gap10">
          <div className="sb-logo" style={{ width: 32, height: 32, borderRadius: 9 }}><Icon n="pulse" size={17} strokeWidth={2.4} /></div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>IC Clínica</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Meu acompanhamento</div>
          </div>
        </div>
        <div className="row gap10">
          {connected
            ? <span className="badge good"><span className="bdot" />Garmin conectado</span>
            : <button className="btn ghost sm" onClick={() => router.push('/portal/conectar')}><Icon n="plug" size={14} />Conectar Garmin</button>}
          <div className="avatar" style={{ width: 32, height: 32, background: '#2f8f6f', fontSize: 12 }}>{userName ? userName.slice(0, 2).toUpperCase() : 'U'}</div>
          <button className="icon-btn" title="Sair" onClick={async () => { await getSupabase().auth.signOut(); router.push('/portal/login'); }}><Icon n="logout" size={17} /></button>
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 24px 60px' }}>
        <div className="between" style={{ marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div className="eyebrow" style={{ color: 'var(--accent)' }}>Meu painel</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>Olá, {userName || 'paciente'} 👋</h1>
            <p className="muted" style={{ marginTop: 2, fontSize: 13 }}>
              Seus treinos e sinais vitais do Garmin dos últimos 6 meses.
              {lastSync && <> · sincronizado {new Date(lastSync).toLocaleString('pt-BR')}</>}
            </p>
          </div>
          <button className="btn ghost sm" onClick={() => router.push('/portal/refeicao')}><Icon n="flame" size={14} />Registrar refeição</button>
        </div>

        {!connected && (
          <div className="card" style={{ padding: 20, marginBottom: 20, borderColor: 'var(--accent)', borderWidth: 1.5, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--accent-soft)', display: 'grid', placeItems: 'center' }}><Icon n="plug" size={20} style={{ color: 'var(--accent)' }} /></div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Conecte seu Garmin</div>
              <div className="muted" style={{ fontSize: 12.5 }}>Depois de conectar uma vez, seus dados ficam salvos e atualizam sozinhos.</div>
            </div>
            <button className="btn primary sm" onClick={() => router.push('/portal/conectar')}>Conectar agora<Icon n="arrowRight" size={15} /></button>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 60 }}><span className="spin" style={{ width: 30, height: 30, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }} /></div>
        ) : !hasData ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <Icon n="activity" size={30} style={{ color: 'var(--text-faint)' }} />
            <h3 style={{ fontWeight: 800, fontSize: 16, marginTop: 10 }}>Sem dados ainda</h3>
            <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
              {connected ? 'Estamos sincronizando com o Garmin — volte em instantes.' : 'Conecte seu Garmin para ver seus treinos e sinais vitais aqui.'}
            </p>
          </div>
        ) : (
          <>
            {/* Cards de resumo */}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12, marginBottom: 22 }}>
              <SummaryCard icon="activity" label="Treinos (6 meses)" value={fmt(summary.workouts)} />
              <SummaryCard icon="flame" label="Calorias ativas" value={fmt(summary.kcal)} unit=" kcal" />
              <SummaryCard icon="foot" label="Distância total" value={summary.distKm.toFixed(1)} unit=" km" />
              <SummaryCard icon="heart" label="FC média (treinos)" value={summary.avgHr ? fmt(summary.avgHr) : '—'} unit={summary.avgHr ? ' bpm' : ''} />
              {summary.hasSleep && <SummaryCard icon="moon" label="Sono médio" value={String(summary.avgSleepH)} unit=" h" />}
              {summary.hasHrv && <SummaryCard icon="pulse" label="HRV médio" value={fmt(summary.avgHrv)} unit=" ms" />}
            </div>

            {/* Evolução mensal */}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, marginBottom: 22 }}>
              <ChartCard title="Treinos por mês" sub="Últimos 6 meses">
                <BarChart data={charts.workouts} height={160} fmtV={(v) => `${v} treino${v === 1 ? '' : 's'}`} />
                <MonthAxis months={charts.months} />
              </ChartCard>
              <ChartCard title="Calorias ativas por mês" sub="Soma mensal">
                <BarChart data={charts.kcal} color="var(--warn, #e8843c)" height={160} unit=" kcal" />
                <MonthAxis months={charts.months} />
              </ChartCard>
              {summary.hasSleep && (
                <ChartCard title="Sono — média mensal" sub="Horas por noite">
                  <LineChart data={charts.sleep} height={160} unit=" h" />
                  <MonthAxis months={charts.months} />
                </ChartCard>
              )}
              {summary.hasHrv && (
                <ChartCard title="HRV — média mensal" sub="Variabilidade (ms)">
                  <LineChart data={charts.hrv} color="var(--accent-strong, #2f8f6f)" height={160} unit=" ms" />
                  <MonthAxis months={charts.months} />
                </ChartCard>
              )}
            </div>

            {/* Últimos treinos */}
            {recent.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>Últimos treinos</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: 'var(--text-faint)', textAlign: 'left', fontSize: 11.5 }}>
                        <th style={{ padding: '10px 18px', fontWeight: 600 }}>Atividade</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600 }}>Data</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600 }}>Duração</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600 }}>Calorias</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600 }}>Distância</th>
                        <th style={{ padding: '10px 18px', fontWeight: 600 }}>FC média</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((a) => (
                        <tr key={a.id} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 18px', fontWeight: 600, textTransform: 'capitalize' }}>{a.tipo.replace(/_/g, ' ')}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{new Date(a.inicio).toLocaleDateString('pt-BR')}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{dur(a.inicio, a.fim)}</td>
                          <td style={{ padding: '10px 12px' }}>{a.kcal != null ? `${fmt(a.kcal)} kcal` : '—'}</td>
                          <td style={{ padding: '10px 12px' }}>{a.distancia_m != null ? `${(a.distancia_m / 1000).toFixed(2)} km` : '—'}</td>
                          <td style={{ padding: '10px 18px' }}>{a.fc_media != null ? `${a.fc_media} bpm` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, unit = '' }: { icon: string; label: string; value: string; unit?: string }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="row gap8" style={{ marginBottom: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface-2)', display: 'grid', placeItems: 'center' }}><Icon n={icon} size={16} style={{ color: 'var(--accent)' }} /></div>
        <span style={{ fontSize: 11.5, color: 'var(--text-faint)', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{value}<span style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 600 }}>{unit}</span></div>
    </div>
  );
}

function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="between" style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function MonthAxis({ months }: { months: string[] }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', marginTop: 4, padding: '0 4px' }}>
      {months.map((m) => (
        <span key={m} style={{ fontSize: 10, color: 'var(--text-faint)' }}>{monthLabel(m)}</span>
      ))}
    </div>
  );
}
