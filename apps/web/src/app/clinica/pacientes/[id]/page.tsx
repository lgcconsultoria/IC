'use client';
/* IC Clínica — Perfil do paciente (visão 360º) */
import { useState, useEffect, type ReactNode } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Icon } from '@/components/icons';
import { LineChart, BarChart } from '@/components/charts';
import {
  Avatar,
  DeviceBadge,
  PerfBadge,
  AdherenceScore,
  GoalProgress,
  WeeklySummary,
  AlertCard,
  Trend,
  syncLabel,
  EmptyState,
} from '@/components/ui';
import { DATA, DEMO, DEVICES, type Patient, type SeriesPoint, type AlertItem } from '@/lib/clinic-data';
import { loadPatient, loadPatientWearables, applyRealWearables, loadMeasurements, applyRealWeight, createMeasurement } from '@/lib/patient-source';
import { loadPatientAlerts } from '@/lib/alerts-source';

function Stat({ label, value, unit, trend, invert, color }: { label: string; value: ReactNode; unit?: string; trend?: number; invert?: boolean; color?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 600, marginBottom: 3 }}>{label}</div>
      <div className="row gap8" style={{ alignItems: 'baseline' }}>
        <span className="tnum" style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', color }}>{value}</span>
        {unit && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{unit}</span>}
        {trend != null && <Trend value={trend} invert={invert} />}
      </div>
    </div>
  );
}

function ChartBox({ title, sub, color, data, goal, unit, kind = 'line', fmtV, tag }: { title: string; sub?: string; color: string; data: SeriesPoint[]; goal?: number; unit?: string; kind?: 'line' | 'bar'; fmtV?: (v: number) => string; tag?: ReactNode }) {
  return (
    <div className="card card-pad">
      <div className="between" style={{ marginBottom: 12 }}>
        <div>
          <div className="row gap8">
            <span style={{ width: 9, height: 9, borderRadius: 3, background: color }} />
            <span style={{ fontWeight: 700, fontSize: 13.5 }}>{title}</span>
          </div>
          {sub && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2, marginLeft: 17 }}>{sub}</div>}
        </div>
        {tag}
      </div>
      {kind === 'bar' ? <BarChart data={data} color={color} height={150} unit={unit} goal={goal} fmtV={fmtV} /> : <LineChart data={data} color={color} height={150} unit={unit} goal={goal} fmtV={fmtV} />}
    </div>
  );
}

function MeasurementForm({ patientId, onSaved }: { patientId: string; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(today);
  const [peso, setPeso] = useState('');
  const [gordura, setGordura] = useState('');
  const [cintura, setCintura] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<'idle' | 'ok' | 'err'>('idle');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('idle');
    const ok = await createMeasurement(patientId, {
      data,
      pesoKg: peso ? +peso : undefined,
      percentualGordura: gordura ? +gordura : undefined,
      circCintura: cintura ? +cintura : undefined,
    });
    setSaving(false);
    setMsg(ok ? 'ok' : 'err');
    if (ok) {
      setPeso('');
      setGordura('');
      setCintura('');
      onSaved();
      setTimeout(() => { setMsg('idle'); setOpen(false); }, 1200);
    }
  }

  const field = { flex: 1, minWidth: 90, padding: '9px 11px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 } as const;

  return (
    <div className="card card-pad">
      <div className="between">
        <div className="section-title" style={{ fontSize: 15 }}>Registrar medição</div>
        <button className="btn ghost sm" onClick={() => setOpen((o) => !o)}>
          <Icon n={open ? 'chevR' : 'plus'} size={15} />
          {open ? 'Fechar' : 'Nova medição'}
        </button>
      </div>
      {open && (
        <form onSubmit={submit} className="fade-in" style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          <div className="row gap8" style={{ flexWrap: 'wrap' }}>
            <label style={{ flex: 1, minWidth: 90 }}>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>Data</div>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} required style={field} />
            </label>
            <label style={{ flex: 1, minWidth: 90 }}>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>Peso (kg)</div>
              <input type="number" step="0.1" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="78.4" style={field} />
            </label>
            <label style={{ flex: 1, minWidth: 90 }}>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>% gordura</div>
              <input type="number" step="0.1" inputMode="decimal" value={gordura} onChange={(e) => setGordura(e.target.value)} placeholder="22.5" style={field} />
            </label>
            <label style={{ flex: 1, minWidth: 90 }}>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>Cintura (cm)</div>
              <input type="number" step="0.1" inputMode="decimal" value={cintura} onChange={(e) => setCintura(e.target.value)} placeholder="84" style={field} />
            </label>
          </div>
          <div className="row gap8" style={{ alignItems: 'center' }}>
            <button type="submit" className="btn primary sm" disabled={saving || !peso}>
              <Icon n={msg === 'ok' ? 'check' : 'scale'} size={15} />
              {saving ? 'Salvando…' : msg === 'ok' ? 'Registrada!' : 'Salvar medição'}
            </button>
            {msg === 'err' && <span style={{ fontSize: 12, color: 'var(--crit)' }}>Falha ao salvar</span>}
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>O IMC é calculado automaticamente a partir da altura.</span>
          </div>
        </form>
      )}
    </div>
  );
}

const TABS: [string, string, string][] = [
  ['overview', 'Visão geral', 'grid'],
  ['activity', 'Atividade', 'activity'],
  ['sleep', 'Sono', 'moon'],
  ['cardio', 'Cardio', 'heart'],
  ['body', 'Peso', 'scale'],
  ['goals', 'Metas', 'target'],
  ['timeline', 'Timeline', 'clock'],
];

export default function ProfilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [p, setP] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [reporting, setReporting] = useState(false);
  const [realData, setRealData] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setRealData(false);
    setAlerts(null);
    loadPatient(id).then(async (res) => {
      if (!alive) return;
      if (!res) {
        setP(res);
        setLoading(false);
        return;
      }
      let merged = res;
      // dados reais de wearable (ROOK)
      const rows = await loadPatientWearables(id);
      if (!alive) return;
      if (rows.length > 0) {
        merged = applyRealWearables(merged, rows);
        setRealData(true);
      }
      // peso real (medições da equipe)
      const meas = await loadMeasurements(id);
      if (!alive) return;
      if (meas.length > 0) merged = applyRealWeight(merged, meas);
      setP(merged);
      // alertas reais do paciente (fallback demo)
      const al = await loadPatientAlerts(id);
      if (!alive) return;
      setAlerts(al);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="page page-wide">
        <div className="card card-pad" style={{ height: 140 }}>
          <div className="skel" style={{ width: 200, height: 22, marginBottom: 12 }} />
          <div className="skel" style={{ width: 320, height: 14 }} />
        </div>
      </div>
    );
  }

  if (!p) {
    return (
      <div className="page page-wide">
        <button className="btn ghost sm" style={{ marginBottom: 16 }} onClick={() => router.push('/clinica/pacientes')}>
          <Icon n="chevL" size={15} />
          Voltar para pacientes
        </button>
        <div className="card card-pad">Paciente não encontrado.</div>
      </div>
    );
  }

  const myAlerts = alerts ?? (DEMO ? DATA.alerts.filter((a) => a.patient === p.id) : []);
  const hasW = p.hasData;
  const bmi = p.weight && p.heightCm ? (p.weight / Math.pow(p.heightCm / 100, 2)).toFixed(1) : null;
  const goGoals = () => router.push(`/clinica/pacientes/${p.id}/metas`);

  async function reloadWeight() {
    const meas = await loadMeasurements(id);
    if (meas.length > 0) setP((prev) => (prev ? applyRealWeight(prev, meas) : prev));
  }

  const emptyWearable = (
    <div className="card">
      <EmptyState
        icon="wifiOff"
        title="Sem dados de wearable ainda"
        desc="As métricas de atividade, sono e frequência cardíaca aparecem aqui assim que o paciente conectar o dispositivo e a sincronização ocorrer."
      />
    </div>
  );

  const overview = (
    <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', alignItems: 'start' }}>
      <div className="grid">
        {hasW ? (
          <>
            <div className="card card-pad">
              <div className="section-title" style={{ fontSize: 15, marginBottom: 14 }}>Resumo da semana</div>
              <WeeklySummary p={p} />
            </div>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {p.s.steps.length > 0 && <ChartBox title="Passos" sub="meta 10.000/dia" color="var(--c-steps)" data={p.s.steps} goal={10000} />}
              {p.s.calories.length > 0 && <ChartBox title="Calorias ativas" color="var(--c-cal)" data={p.s.calories} kind="bar" unit=" kcal" />}
            </div>
            <div className="card card-pad">
              <div className="between" style={{ marginBottom: 8 }}>
                <div className="section-title" style={{ fontSize: 15 }}>Atividade vs. meta prescrita</div>
                <button className="btn ghost sm" onClick={goGoals}>Editar metas</button>
              </div>
              <div style={{ display: 'grid', gap: 16, marginTop: 8 }}>
                <GoalProgress icon="foot" label="Passos / dia" value={p.steps} goal={p.goalSteps} color="var(--c-steps)" />
                <GoalProgress icon="flame" label="Calorias ativas / sem" value={p.calories} goal={p.goalCal} color="var(--c-cal)" />
                <GoalProgress icon="moon" label="Sono / noite" value={p.sleep} goal={p.goalSleep} unit="h" color="var(--c-sleep)" />
              </div>
            </div>
          </>
        ) : (
          emptyWearable
        )}
      </div>
      <div className="grid">
        <div className="card card-pad">
          <div className="section-title" style={{ fontSize: 15, marginBottom: 12 }}>Sinais vitais (médias)</div>
          {hasW ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Stat label="FC repouso" value={p.restingHr || '—'} unit="bpm" color="var(--c-hr)" />
              <Stat label="HRV" value={p.hrv || '—'} unit="ms" color="var(--c-hrv)" />
              <Stat label="Peso" value={p.weight || '—'} unit="kg" color="var(--c-weight)" />
              <Stat label="IMC" value={bmi ?? '—'} color="var(--text)" />
            </div>
          ) : (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Sem dados de wearable. Peso e IMC aparecem após o registro de medições (aba <b>Peso</b>).
            </p>
          )}
        </div>
        {myAlerts.length > 0 && (
          <div className="card card-pad">
            <div className="between" style={{ marginBottom: 12 }}>
              <div className="section-title" style={{ fontSize: 15 }}>Alertas do paciente</div>
              <span className="badge warn">{myAlerts.length}</span>
            </div>
            <div className="grid" style={{ gap: 10 }}>
              {myAlerts.map((a) => (
                <AlertCard key={a.id} a={a} patient={p} compact />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const activity =
    hasW && (p.s.steps.length > 0 || p.s.calories.length > 0) ? (
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {p.s.steps.length > 0 && <ChartBox title="Passos diários" sub="meta 10.000/dia" color="var(--c-steps)" data={p.s.steps} goal={10000} />}
        {p.s.calories.length > 0 && <ChartBox title="Calorias ativas" color="var(--c-cal)" data={p.s.calories} kind="bar" unit=" kcal" />}
      </div>
    ) : (
      emptyWearable
    );

  const sleep =
    hasW && p.s.sleep.length > 0 ? (
      <div className="grid">
        <ChartBox title="Horas de sono" sub="meta 7.5h/noite" color="var(--c-sleep)" data={p.s.sleep} goal={7.5} fmtV={(v) => v + 'h'} />
      </div>
    ) : (
      emptyWearable
    );

  const cardio =
    hasW && (p.s.hr.length > 0 || p.s.hrv.length > 0) ? (
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {p.s.hr.length > 0 && <ChartBox title="Frequência cardíaca de repouso" sub="bpm" color="var(--c-hr)" data={p.s.hr} unit=" bpm" />}
        {p.s.hrv.length > 0 && <ChartBox title="Variabilidade (HRV)" sub="ms" color="var(--c-hrv)" data={p.s.hrv} unit=" ms" />}
      </div>
    ) : (
      emptyWearable
    );

  const body = (
    <div className="grid">
      <MeasurementForm patientId={p.id} onSaved={reloadWeight} />
      {p.s.weight.length > 0 ? (
        <>
          <ChartBox title="Evolução de peso" sub="kg" color="var(--c-weight)" data={p.s.weight} fmtV={(v) => v + ' kg'} />
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
            {([['Peso atual', (p.weight || '—') + ' kg'], ['IMC', bmi ?? '—'], ['Altura', p.heightCm ? p.heightCm + ' cm' : '—']] as [string, string][]).map((s, i) => (
              <div key={i} className="card card-pad">
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>{s[0]}</div>
                <div className="row gap8" style={{ alignItems: 'baseline', marginTop: 5 }}>
                  <span className="tnum" style={{ fontSize: 22, fontWeight: 800 }}>{s[1]}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="card">
          <EmptyState icon="scale" title="Sem medições registradas" desc="Registre a primeira medição acima para acompanhar a evolução de peso e IMC." />
        </div>
      )}
    </div>
  );

  const goalsTab = (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <div className="card card-pad">
        <div className="section-title" style={{ fontSize: 15, marginBottom: 16 }}>Progresso das metas</div>
        {hasW ? (
          <div style={{ display: 'grid', gap: 18 }}>
            <GoalProgress icon="foot" label="Passos / dia" value={p.steps} goal={p.goalSteps} color="var(--c-steps)" />
            <GoalProgress icon="flame" label="Calorias ativas / sem" value={p.calories} goal={p.goalCal} color="var(--c-cal)" />
            <GoalProgress icon="moon" label="Sono / noite" value={p.sleep} goal={p.goalSleep} unit="h" color="var(--c-sleep)" />
          </div>
        ) : (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            O progresso aparece quando há dados de wearable sincronizados. Você já pode definir as metas prescritas ao lado.
          </p>
        )}
      </div>
      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'color-mix(in oklch, var(--accent) 14%, transparent)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
          <Icon n="target" size={26} />
        </div>
        <div style={{ maxWidth: 280 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Metas prescritas</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>Defina passos, calorias, treinos, minutos ativos, sono e peso-alvo para este paciente.</div>
        </div>
        <button className="btn primary" onClick={goGoals}>
          <Icon n="target" size={16} />
          Ajustar metas
        </button>
      </div>
    </div>
  );

  const timeline = (
    <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', alignItems: 'start' }}>
      <div className="card">
        <EmptyState
          icon="clock"
          title="Linha do tempo em breve"
          desc="Eventos (sincronizações, treinos, anotações clínicas) aparecerão aqui conforme forem registrados."
        />
      </div>
      {myAlerts.length > 0 && (
        <div className="grid">
          {myAlerts.map((a) => (
            <AlertCard key={a.id} a={a} patient={p} onOpen={() => {}} compact={false} />
          ))}
        </div>
      )}
    </div>
  );

  const content: Record<string, ReactNode> = { overview, activity, sleep, cardio, body, goals: goalsTab, timeline };

  return (
    <div className="page page-wide">
      <button className="btn ghost sm" style={{ marginBottom: 16 }} onClick={() => router.push('/clinica/pacientes')}>
        <Icon n="chevL" size={15} />
        Voltar para pacientes
      </button>
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="between" style={{ flexWrap: 'wrap', gap: 16 }}>
          <div className="row gap16">
            <Avatar p={p} size={64} />
            <div>
              <div className="row gap10" style={{ flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em' }}>{p.name}</h2>
                {realData && DEMO && <PerfBadge perf={p.perf} />}
                <span className={'badge ' + (realData ? 'good' : 'neutral')} title={realData ? 'Métricas reais sincronizadas via wearable' : 'Aguardando sincronização do wearable'}>
                  <span className="bdot" />
                  {realData ? 'dados reais' : 'sem dados de wearable'}
                </span>
              </div>
              <div className="row gap12" style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: 12.5, flexWrap: 'wrap' }}>
                {p.age > 0 && (
                  <span className="row gap6">
                    <Icon n="user" size={13} />
                    {p.age + ' anos · ' + (p.sex === 'f' ? 'Feminino' : 'Masculino')}
                  </span>
                )}
                {realData ? (
                  <>
                    <span className="row gap6">
                      <DeviceBadge device={p.device} size={18} />
                      {DEVICES[p.device].name}
                    </span>
                    <span className="row gap6">
                      <Icon n={p.syncHours > 48 ? 'wifiOff' : 'sync'} size={13} style={{ color: p.syncHours > 48 ? 'var(--crit)' : 'var(--good)' }} />
                      {'Sync ' + syncLabel(p.syncHours)}
                    </span>
                  </>
                ) : (
                  <span className="row gap6">
                    <Icon n="wifiOff" size={13} />
                    Wearable não conectado
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="row gap10">
            {p.adherence > 0 && <AdherenceScore value={p.adherence} size={72} stroke={7} showLabel={false} />}
            <div className="grid" style={{ gap: 8 }}>
              <button
                className="btn primary"
                onClick={() => {
                  setReporting(true);
                  setTimeout(() => {
                    setReporting(false);
                    router.push(`/clinica/relatorios?id=${p.id}`);
                  }, 700);
                }}
              >
                {reporting ? (
                  <>
                    <span className="spin" style={{ width: 15, height: 15, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }} />
                    Gerando…
                  </>
                ) : (
                  <>
                    <Icon n="sparkle" size={16} />
                    Gerar relatório IA
                  </>
                )}
              </button>
              <button className="btn ghost" onClick={goGoals}>
                <Icon n="target" size={16} />
                Metas
              </button>
              <button className="btn ghost" onClick={() => router.push(`/clinica/pacientes/${p.id}/nutricao`)}>
                <Icon n="flame" size={16} />
                Nutrição
              </button>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 0, marginTop: 18, borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
          {TABS.map((t) => (
            <button
              key={t[0]}
              onClick={() => setTab(t[0])}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '12px 14px 11px',
                fontSize: 13,
                fontWeight: 600,
                color: tab === t[0] ? 'var(--accent-ink)' : 'var(--text-muted)',
                borderBottom: '2px solid ' + (tab === t[0] ? 'var(--accent)' : 'transparent'),
                marginBottom: -1,
                whiteSpace: 'nowrap',
              }}
            >
              <Icon n={t[2]} size={15} />
              {t[1]}
            </button>
          ))}
        </div>
      </div>
      <div className="fade-in" key={tab}>
        {content[tab]}
      </div>
    </div>
  );
}
