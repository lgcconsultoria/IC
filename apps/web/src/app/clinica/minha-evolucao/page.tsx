'use client';
/* IC Clínica — Minha evolução: acompanhamento do PRÓPRIO relógio pela equipe.
   Reaproveita o registro de autoacompanhamento (patients.eh_funcionario). */
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons';
import { LineChart, BarChart } from '@/components/charts';
import { apiFetch } from '@/lib/api';
import {
  loadMe,
  loadPatientWearables,
  loadPatientActivities,
  type WearableDailyRow,
  type WearableActivityRow,
} from '@/lib/patient-source';
import { loadMetabolism, type Metabolism } from '@/lib/nutrition-source';

type ConnStatus = 'pending' | 'active' | 'reauth_required' | 'disconnected' | 'error';
interface Series { date: string; day: number; value: number }
const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const monthKey = (iso: string) => iso.slice(0, 7);
const monthLabel = (ym: string) => { const [y, m] = ym.split('-'); return `${MONTHS_PT[Number(m) - 1]}/${y.slice(2)}`; };
function lastMonths(n: number): string[] {
  const out: string[] = []; const d = new Date(); d.setDate(1);
  for (let i = n - 1; i >= 0; i--) { const dd = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(`${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}`); }
  return out;
}
const fmt = (n: number) => n.toLocaleString('pt-BR');

export default function MinhaEvolucaoPage() {
  const [pid, setPid] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnStatus>('disconnected');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [daily, setDaily] = useState<WearableDailyRow[]>([]);
  const [acts, setActs] = useState<WearableActivityRow[]>([]);
  const [met, setMet] = useState<Metabolism | null>(null);
  const [loading, setLoading] = useState(true);
  const [mcpUrl, setMcpUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function loadData(id: string) {
    const [d, a, m] = await Promise.all([
      loadPatientWearables(id, 180),
      loadPatientActivities(id, 180),
      loadMetabolism(id),
    ]);
    setDaily(d); setActs(a); setMet(m);
  }

  async function refreshStatus() {
    try {
      const s = await apiFetch<{ status: ConnStatus; lastSyncAt: string | null }>('/garmin/status');
      setStatus(s.status); setLastSync(s.lastSyncAt);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    async function init() {
      const me = await loadMe(); // provisiona o autoacompanhamento da equipe
      if (!me) { setLoading(false); return; }
      setPid(me.id);
      await refreshStatus();
      await loadData(me.id);
      setLoading(false);
      apiFetch('/garmin/sync', { method: 'POST' })
        .then(async () => { await loadData(me.id); await refreshStatus(); })
        .catch(() => { /* poller cuida do resto */ });
    }
    void init();
  }, []);

  async function connect(e?: React.FormEvent) {
    e?.preventDefault();
    setErro(null); setBusy(true);
    try {
      const res = await apiFetch<{ connected?: boolean }>('/garmin/connect', {
        method: 'POST', body: JSON.stringify({ mcpUrl: mcpUrl.trim() }),
      });
      if (res.connected) {
        setMcpUrl('');
        await refreshStatus();
        if (pid) await loadData(pid);
      }
    } catch {
      setErro('Não foi possível conectar. Confira a URL do amalgama.');
    } finally { setBusy(false); }
  }

  const summary = useMemo(() => {
    const kcal = acts.reduce((s, a) => s + (a.kcal ?? 0), 0);
    const dist = acts.reduce((s, a) => s + (a.distancia_m ?? 0), 0);
    const hr = acts.map((a) => a.fc_media).filter((v): v is number => v != null);
    const sleep = daily.map((d) => d.sono_min).filter((v): v is number => v != null);
    const hrv = daily.map((d) => d.hrv).filter((v): v is number => v != null);
    const avg = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
    return { workouts: acts.length, kcal, distKm: dist / 1000, avgHr: Math.round(avg(hr)), avgSleepH: +(avg(sleep) / 60).toFixed(1), avgHrv: Math.round(avg(hrv)), hasSleep: sleep.length > 0, hasHrv: hrv.length > 0 };
  }, [acts, daily]);

  const charts = useMemo(() => {
    const months = lastMonths(6);
    const idx = new Map(months.map((m, i) => [m, i]));
    const workouts = months.map((m) => ({ date: `${m}-01`, day: 0, value: 0 })) as Series[];
    const kcal = months.map((m) => ({ date: `${m}-01`, day: 0, value: 0 })) as Series[];
    for (const a of acts) { const i = idx.get(monthKey(a.inicio)); if (i == null) continue; workouts[i].value += 1; kcal[i].value += a.kcal ?? 0; }
    return { months, workouts, kcal };
  }, [acts]);

  const connected = status === 'active';
  const hasData = acts.length > 0 || daily.length > 0;

  return (
    <div className="page page-wide">
      <div className="between" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 className="page-title" style={{ fontSize: 22 }}>Minha evolução</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            Conecte seu relógio e acompanhe seus próprios treinos e sinais vitais.
            {lastSync && <> · sincronizado {new Date(lastSync).toLocaleString('pt-BR')}</>}
          </div>
        </div>
        {connected && <span className="badge good"><span className="bdot" />Garmin conectado</span>}
      </div>

      {/* Conectar (se ainda não conectado) */}
      {!connected && (
        <form onSubmit={connect} className="card card-pad" style={{ marginBottom: 18 }}>
          <div className="row gap10" style={{ marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-soft)', display: 'grid', placeItems: 'center' }}>
              <Icon n="plug" size={20} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Conectar meu Garmin</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Cole o link de conexão (amalgama) que você gerou.</div>
            </div>
          </div>
          <div className="row gap8" style={{ flexWrap: 'wrap' }}>
            <div className="search" style={{ flex: 1, minWidth: 240 }}>
              <Icon n="plug" size={16} />
              <input type="url" required placeholder="https://…/api/v1/mcp/xxxxxxxx" value={mcpUrl} onChange={(e) => setMcpUrl(e.target.value)} />
            </div>
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? <span className="spin" style={{ width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} /> : <><Icon n="plug" size={16} />Conectar</>}
            </button>
          </div>
          {erro && <p style={{ color: 'var(--crit)', fontSize: 12.5, marginTop: 8 }}>{erro}</p>}
        </form>
      )}

      {/* Balanço metabólico */}
      {met && met.tmb != null && (
        <div className="card card-pad" style={{ marginBottom: 18 }}>
          <div className="section-title" style={{ fontSize: 14, marginBottom: 12 }}>Meu balanço de hoje</div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12 }}>
            <Mini label="Metabolismo basal" value={fmt(met.tmb)} unit=" kcal" />
            <Mini label="Gasto total (TDEE)" value={met.tdee != null ? fmt(met.tdee) : '—'} unit=" kcal" />
            <Mini label="Consumido hoje" value={fmt(met.consumido_hoje)} unit=" kcal" />
            <Mini label={met.balanco === 'superavit' ? 'Acima do gasto' : 'Déficit de hoje'} value={met.saldo_hoje != null ? (met.saldo_hoje > 0 ? '+' : '') + fmt(met.saldo_hoje) : '—'} unit=" kcal" color={met.balanco === 'deficit' ? 'var(--good)' : met.balanco === 'superavit' ? 'var(--warn, #e8843c)' : undefined} />
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 60 }}><span className="spin" style={{ width: 28, height: 28, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }} /></div>
      ) : !hasData ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <Icon n="activity" size={30} style={{ color: 'var(--text-faint)' }} />
          <h3 style={{ fontWeight: 800, fontSize: 16, marginTop: 10 }}>Sem dados ainda</h3>
          <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
            {connected ? 'Estamos sincronizando com o Garmin — volte em instantes.' : 'Conecte seu relógio acima para ver seus treinos aqui.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
            <Card icon="activity" label="Treinos (6 meses)" value={fmt(summary.workouts)} />
            <Card icon="flame" label="Calorias ativas" value={fmt(summary.kcal)} unit=" kcal" />
            <Card icon="foot" label="Distância total" value={summary.distKm.toFixed(1)} unit=" km" />
            <Card icon="heart" label="FC média" value={summary.avgHr ? fmt(summary.avgHr) : '—'} unit={summary.avgHr ? ' bpm' : ''} />
            {summary.hasSleep && <Card icon="moon" label="Sono médio" value={String(summary.avgSleepH)} unit=" h" />}
            {summary.hasHrv && <Card icon="pulse" label="HRV médio" value={fmt(summary.avgHrv)} unit=" ms" />}
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
            <div className="card card-pad">
              <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}>Treinos por mês</div>
              <BarChart data={charts.workouts} height={160} fmtV={(v) => `${v} treino${v === 1 ? '' : 's'}`} />
              <Axis months={charts.months} />
            </div>
            <div className="card card-pad">
              <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}>Calorias ativas por mês</div>
              <LineChart data={charts.kcal} height={160} unit=" kcal" />
              <Axis months={charts.months} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Card({ icon, label, value, unit = '' }: { icon: string; label: string; value: string; unit?: string }) {
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

function Mini({ label, value, unit = '', color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 3 }}>{label}</div>
      <div className="tnum" style={{ fontSize: 20, fontWeight: 800, color: color ?? 'var(--text)' }}>{value}<span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 600 }}>{unit}</span></div>
    </div>
  );
}

function Axis({ months }: { months: string[] }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', marginTop: 4, padding: '0 4px' }}>
      {months.map((m) => <span key={m} style={{ fontSize: 10, color: 'var(--text-faint)' }}>{monthLabel(m)}</span>)}
    </div>
  );
}
