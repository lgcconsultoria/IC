'use client';
/* IC Clínica — Perfil do paciente (visão 360º) */
import { useState, useEffect, type ReactNode } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Icon } from '@/components/icons';
import { LineChart, BarChart, Ring } from '@/components/charts';
import {
  Avatar,
  DeviceBadge,
  PerfBadge,
  AdherenceScore,
  GoalProgress,
  PatientTimeline,
  WeeklySummary,
  AlertCard,
  Trend,
  syncLabel,
} from '@/components/ui';
import { DATA, DEVICES, timelineFor, type Patient, type SeriesPoint } from '@/lib/clinic-data';
import { loadPatient, loadPatientWearables, applyRealWearables } from '@/lib/patient-source';

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

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setRealData(false);
    loadPatient(id).then(async (res) => {
      if (!alive) return;
      if (res) {
        // tenta sobrepor com dados reais de wearable (ROOK)
        const rows = await loadPatientWearables(id);
        if (!alive) return;
        if (rows.length > 0) {
          setP(applyRealWearables(res, rows));
          setRealData(true);
        } else {
          setP(res);
        }
      } else {
        setP(res);
      }
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

  const myAlerts = DATA.alerts.filter((a) => a.patient === p.id);
  const bmi = (p.weight / Math.pow(p.heightCm / 100, 2)).toFixed(1);
  const goGoals = () => router.push(`/clinica/pacientes/${p.id}/metas`);

  const overview = (
    <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', alignItems: 'start' }}>
      <div className="grid">
        <div className="card card-pad">
          <div className="between" style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ fontSize: 15 }}>Resumo da semana</div>
            <span className="badge neutral">vs. semana anterior</span>
          </div>
          <WeeklySummary p={p} />
        </div>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <ChartBox title="Passos" sub="14 dias · meta 10.000/dia" color="var(--c-steps)" data={p.s.steps} goal={10000} tag={<Trend value={p.adherence > 70 ? 8 : -6} />} />
          <ChartBox title="Calorias ativas" sub="14 dias" color="var(--c-cal)" data={p.s.calories} kind="bar" unit=" kcal" />
        </div>
        <div className="card card-pad">
          <div className="between" style={{ marginBottom: 8 }}>
            <div className="section-title" style={{ fontSize: 15 }}>Meta prescrita vs. realizado</div>
            <button className="btn ghost sm" onClick={goGoals}>Editar metas</button>
          </div>
          <div style={{ display: 'grid', gap: 16, marginTop: 8 }}>
            <GoalProgress icon="foot" label="Passos / dia" value={p.steps} goal={p.goalSteps} color="var(--c-steps)" />
            <GoalProgress icon="flame" label="Calorias ativas / sem" value={p.calories} goal={p.goalCal} color="var(--c-cal)" />
            <GoalProgress icon="dumbbell" label="Treinos / semana" value={p.workouts} goal={p.goalWorkouts} color="var(--accent)" />
            <GoalProgress icon="moon" label="Sono / noite" value={p.sleep} goal={p.goalSleep} unit="h" color="var(--c-sleep)" />
          </div>
        </div>
      </div>
      <div className="grid">
        <div className="card card-pad">
          <div className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>Resumo clínico-comportamental</div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 8 }}>
            {p.perf === 'high'
              ? `${p.name.split(' ')[0]} mantém excelente engajamento: atividade consistente, sono dentro da meta e aderência crescente. Bom candidato a progressão de metas.`
              : p.perf === 'mid'
              ? `${p.name.split(' ')[0]} apresenta padrão irregular — boa atividade em dias úteis, queda nos fins de semana. Sono ligeiramente abaixo da meta. Reforço comportamental recomendado.`
              : `${p.name.split(' ')[0]} mostra sinais de baixa aderência e possível desmotivação. Atividade e sono abaixo das metas, sincronização irregular. Requer contato ativo e revisão de metas.`}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {p.tags.map((t) => (
              <span key={t} className="chip" style={{ fontSize: 11, padding: '3px 9px' }}>{t.replace(/-/g, ' ')}</span>
            ))}
          </div>
        </div>
        <div className="card card-pad">
          <div className="section-title" style={{ fontSize: 15, marginBottom: 12 }}>Sinais vitais (médias)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Stat label="FC repouso" value={p.restingHr} unit="bpm" color="var(--c-hr)" trend={p.perf === 'high' ? -3 : 4} invert />
            <Stat label="HRV" value={p.hrv} unit="ms" color="var(--c-hrv)" trend={p.perf === 'high' ? 6 : -5} />
            <Stat label="Peso" value={p.weight} unit="kg" color="var(--c-weight)" trend={-1.1} invert />
            <Stat label="IMC" value={bmi} color="var(--text)" />
          </div>
        </div>
        {myAlerts.length > 0 && (
          <div className="card card-pad">
            <div className="between" style={{ marginBottom: 12 }}>
              <div className="section-title" style={{ fontSize: 15 }}>Alertas do paciente</div>
              <span className="badge warn">{myAlerts.length}</span>
            </div>
            <div className="grid" style={{ gap: 10 }}>
              {myAlerts.map((a) => (
                <AlertCard key={a.id} a={a} compact />
              ))}
            </div>
          </div>
        )}
        <div className="card card-pad">
          <div className="section-title" style={{ fontSize: 15, marginBottom: 14 }}>Atividade recente</div>
          <PatientTimeline items={timelineFor(p).slice(0, 4)} />
        </div>
      </div>
    </div>
  );

  const activity = (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <ChartBox title="Passos diários" sub="meta 10.000/dia" color="var(--c-steps)" data={p.s.steps} goal={10000} />
      <ChartBox title="Calorias ativas" sub="14 dias" color="var(--c-cal)" data={p.s.calories} kind="bar" unit=" kcal" />
      <div style={{ gridColumn: '1 / -1' }}>
        <div className="card card-pad">
          <div className="section-title" style={{ fontSize: 15, marginBottom: 8 }}>Treinos por dia</div>
          <BarChart data={p.s.calories.map((d, i) => ({ ...d, value: i % 2 === 0 && p.workouts > 0 ? 1 : 0 }))} color="var(--accent)" height={90} fmtV={(v) => (v ? 'treino' : 'descanso')} />
        </div>
      </div>
    </div>
  );

  const sleep = (
    <div className="grid">
      <ChartBox title="Horas de sono" sub="meta 7.5h/noite" color="var(--c-sleep)" data={p.s.sleep} goal={7.5} fmtV={(v) => v + 'h'} />
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        {([['Sono profundo', '1.4h', 19], ['Sono REM', '1.8h', 24], ['Eficiência', '88%', 88]] as [string, string, number][]).map((s, i) => (
          <div key={i} className="card card-pad" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>{s[0]}</div>
            <div className="tnum" style={{ fontSize: 26, fontWeight: 800, margin: '6px 0' }}>{s[1]}</div>
            <div className="progress-track" style={{ height: 6 }}>
              <div className="progress-fill" style={{ width: s[2] + '%', background: 'var(--c-sleep)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const cardio = (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <ChartBox title="Frequência cardíaca de repouso" sub="bpm · 14 dias" color="var(--c-hr)" data={p.s.hr} unit=" bpm" />
      <ChartBox title="Variabilidade (HRV)" sub="ms · 14 dias" color="var(--c-hrv)" data={p.s.hrv} unit=" ms" />
      <div style={{ gridColumn: '1 / -1' }}>
        <div className="card card-pad">
          <div className="between">
            <div className="row gap16">
              <Ring value={p.hrv} max={90} size={76} stroke={8} color="var(--c-hrv)">
                <div style={{ textAlign: 'center' }}>
                  <div className="tnum" style={{ fontSize: 18, fontWeight: 800 }}>{p.hrv}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-faint)' }}>ms</div>
                </div>
              </Ring>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.perf === 'high' ? 'Recuperação boa' : p.perf === 'mid' ? 'Recuperação moderada' : 'Recuperação baixa'}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', maxWidth: 420, marginTop: 2 }}>
                  {'Combinação de HRV e FC de repouso indica ' + (p.perf === 'high' ? 'boa prontidão para treino de intensidade.' : 'necessidade de recuperação antes de cargas altas.')}
                </div>
              </div>
            </div>
            <span className={'badge ' + (p.perf === 'high' ? 'good' : p.perf === 'mid' ? 'warn' : 'crit')}>
              <span className="bdot" />
              {p.perf === 'high' ? 'Prontidão alta' : p.perf === 'mid' ? 'Prontidão média' : 'Prontidão baixa'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const body = (
    <div className="grid">
      <ChartBox title="Evolução de peso" sub="kg · 30 dias" color="var(--c-weight)" data={p.s.weight} fmtV={(v) => v + ' kg'} />
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {([['Peso atual', p.weight + ' kg', -1.1], ['IMC', bmi, -0.3], ['Altura', p.heightCm + ' cm', null], ['Meta de peso', p.weight - 4 + ' kg', null]] as [string, string, number | null][]).map((s, i) => (
          <div key={i} className="card card-pad">
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>{s[0]}</div>
            <div className="row gap8" style={{ alignItems: 'baseline', marginTop: 5 }}>
              <span className="tnum" style={{ fontSize: 22, fontWeight: 800 }}>{s[1]}</span>
              {s[2] != null && <Trend value={s[2]} suffix="kg" invert />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const goalsTab = (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <div className="card card-pad">
        <div className="section-title" style={{ fontSize: 15, marginBottom: 16 }}>Progresso das metas</div>
        <div style={{ display: 'grid', gap: 18 }}>
          <GoalProgress icon="foot" label="Passos / dia" value={p.steps} goal={p.goalSteps} color="var(--c-steps)" />
          <GoalProgress icon="flame" label="Calorias ativas / sem" value={p.calories} goal={p.goalCal} color="var(--c-cal)" />
          <GoalProgress icon="dumbbell" label="Treinos / semana" value={p.workouts} goal={p.goalWorkouts} color="var(--accent)" />
          <GoalProgress icon="clock" label="Minutos ativos / dia" value={Math.round(p.steps / 350)} goal={p.goalActiveMin} unit="min" color="var(--info)" />
          <GoalProgress icon="moon" label="Sono / noite" value={p.sleep} goal={p.goalSleep} unit="h" color="var(--c-sleep)" />
        </div>
      </div>
      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <AdherenceScore value={p.adherence} size={130} stroke={12} />
        <div style={{ maxWidth: 280 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Score de aderência geral</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>Calculado a partir do cumprimento ponderado de todas as metas nos últimos 7 dias.</div>
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
      <div className="card card-pad">
        <div className="section-title" style={{ fontSize: 15, marginBottom: 16 }}>Linha do tempo de eventos</div>
        <PatientTimeline items={timelineFor(p)} />
      </div>
      {myAlerts.length > 0 && (
        <div className="grid">
          {myAlerts.map((a) => (
            <AlertCard key={a.id} a={a} onOpen={() => {}} compact={false} />
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
                <PerfBadge perf={p.perf} />
                <span className={'badge ' + (realData ? 'good' : 'neutral')} title={realData ? 'Métricas reais sincronizadas via wearable' : 'Métricas demonstrativas até a sincronização do wearable'}>
                  <span className="bdot" />
                  {realData ? 'dados reais' : 'demonstrativo'}
                </span>
              </div>
              <div className="row gap12" style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: 12.5, flexWrap: 'wrap' }}>
                <span className="row gap6">
                  <Icon n="user" size={13} />
                  {p.age + ' anos · ' + (p.sex === 'f' ? 'Feminino' : 'Masculino')}
                </span>
                <span className="row gap6">
                  <DeviceBadge device={p.device} size={18} />
                  {DEVICES[p.device].name}
                </span>
                <span className="row gap6">
                  <Icon n={p.syncHours > 48 ? 'wifiOff' : 'sync'} size={13} style={{ color: p.syncHours > 48 ? 'var(--crit)' : 'var(--good)' }} />
                  {'Sync ' + syncLabel(p.syncHours)}
                </span>
              </div>
            </div>
          </div>
          <div className="row gap10">
            <AdherenceScore value={p.adherence} size={72} stroke={7} showLabel={false} />
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
