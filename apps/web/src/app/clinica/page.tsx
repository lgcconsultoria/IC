'use client';
/* IC Clínica — Dashboard */
import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons';
import { LineChart, BarChart, Donut, Ring } from '@/components/charts';
import { MetricCard, Avatar, adhColor, syncLabel, LoadingSkeleton, EmptyState } from '@/components/ui';
import { fmt, type Patient } from '@/lib/clinic-data';
import { loadClinicPatients } from '@/lib/patient-source';
import { loadAlerts } from '@/lib/alerts-source';

interface ClinicStats {
  totalPatients: number;
  activePatients: number;
  noSync: number;
  lowAdherence: number;
  critAlerts: number;
  weeklyEvolution: number;
}

function KpiStrip({ c, goPatients, goAlerts }: { c: ClinicStats; goPatients: (f?: string) => void; goAlerts: () => void }) {
  const kpis: { icon: string; label: string; value: ReactNode; accent: string; sub?: string; go?: () => void }[] = [
    { icon: 'users', label: 'Total de pacientes', value: c.totalPatients, accent: 'var(--accent)', sub: 'cadastrados na clínica' },
    { icon: 'pulse', label: 'Pacientes ativos', value: c.activePatients, accent: 'var(--info)', sub: 'sincronizando < 48h' },
    { icon: 'wifiOff', label: 'Sem sincronização', value: c.noSync, accent: 'var(--warn)', sub: 'com wearable parado', go: () => goPatients('sem-sync') },
    { icon: 'trend', label: 'Baixa aderência', value: c.lowAdherence, accent: 'var(--crit)', sub: '< 50% da meta', go: () => goPatients('baixa-aderencia') },
    { icon: 'warn', label: 'Alertas críticos', value: c.critAlerts, accent: 'var(--crit)', sub: 'requerem ação', go: goAlerts },
    { icon: 'sparkle', label: 'Aderência média', value: c.weeklyEvolution ? c.weeklyEvolution + '%' : '—', accent: 'var(--good)', sub: 'pacientes com dados' },
  ];
  return (
    <div className="metrics-grid stagger">
      {kpis.map((k, i) => (
        <MetricCard key={i} icon={k.icon} label={k.label} value={k.value} accent={k.accent} sub={k.sub} onClick={k.go} />
      ))}
    </div>
  );
}

function ChartCard({ title, sub, right, children, legend }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; legend?: ReactNode }) {
  return (
    <div className="card card-pad">
      <div className="between" style={{ marginBottom: 14 }}>
        <div>
          <div className="section-title" style={{ fontSize: 14.5 }}>{title}</div>
          {sub && <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 1 }}>{sub}</div>}
        </div>
        {right}
      </div>
      {children}
      {legend}
    </div>
  );
}

function PriorityList({ patients, goPatients, goPatient }: { patients: Patient[]; goPatients: () => void; goPatient: (id: string) => void }) {
  const ps = [...patients].sort((a, b) => a.adherence - b.adherence || b.alertCount - a.alertCount).slice(0, 5);
  return (
    <div className="card">
      <div className="between" style={{ padding: '16px 18px 12px' }}>
        <div>
          <div className="section-title" style={{ fontSize: 14.5 }}>Pacientes prioritários</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 1 }}>Ordenados por menor aderência e alertas abertos</div>
        </div>
        <button className="btn ghost sm" onClick={goPatients}>
          Ver todos
          <Icon n="arrowRight" size={14} />
        </button>
      </div>
      <div>
        {ps.map((p) => (
          <div
            key={p.id}
            className="between"
            style={{ padding: '11px 18px', borderTop: '1px solid var(--border)', cursor: 'pointer' }}
            onClick={() => goPatient(p.id)}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div className="row gap12" style={{ minWidth: 0 }}>
              <div style={{ position: 'relative' }}>
                <Avatar p={p} size={38} />
                <div style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 50, background: p.adherence > 0 ? adhColor(p.adherence) : 'var(--border-strong)', border: '2px solid var(--surface)' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{p.name}</div>
                <div className="row gap8" style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                  <span>{p.age + ' anos'}</span>
                  <span>·</span>
                  {p.syncHours > 48 ? (
                    <span style={{ color: 'var(--crit)', fontWeight: 600 }}>{'sem sync ' + syncLabel(p.syncHours)}</span>
                  ) : (
                    <span>{'sync ' + syncLabel(p.syncHours)}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="row gap16 hide-sm">
              <div style={{ textAlign: 'right' }}>
                <div className="tnum" style={{ fontSize: 13, fontWeight: 700 }}>{fmt(p.steps)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>passos</div>
              </div>
              {p.alertCount > 0 && (
                <span className="badge warn">
                  <Icon n="bell" size={12} />
                  {p.alertCount}
                </span>
              )}
              <Ring value={p.adherence > 0 ? p.adherence : 0} size={38} stroke={4.5} color={p.adherence > 0 ? adhColor(p.adherence) : 'var(--border-strong)'}>
                <span className="tnum" style={{ fontSize: 12, fontWeight: 800 }}>{p.adherence > 0 ? p.adherence : '—'}</span>
              </Ring>
              <Icon n="chevR" size={16} style={{ color: 'var(--text-faint)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function aggregate(patients: Patient[], key: 'steps' | 'calories' | 'sleep') {
  const withData = patients.filter((p) => p.s[key] && p.s[key].length > 0);
  if (withData.length === 0) return [];
  const ref = withData[0]!.s[key];
  const dec = key === 'sleep';
  return ref.map((point, idx) => {
    const sum = withData.reduce((a, p) => a + (p.s[key][idx]?.value ?? 0), 0);
    const v = sum / withData.length;
    return { date: point.date, day: point.day, value: dec ? Math.round(v * 10) / 10 : Math.round(v) };
  });
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function todayLabel() {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [stats, setStats] = useState<ClinicStats>({
    totalPatients: 0,
    activePatients: 0,
    noSync: 0,
    lowAdherence: 0,
    critAlerts: 0,
    weeklyEvolution: 0,
  });

  useEffect(() => {
    import('@/lib/api').then(({ apiFetch }) =>
      apiFetch<{ nome: string }>('/users/me')
        .then((p) => setUserName(p.nome ? p.nome.split(' ')[0] : ''))
        .catch(() =>
          import('@/lib/supabase').then(({ getSupabase }) =>
            getSupabase().auth.getUser().then(({ data }) => {
              if (data.user?.email) setUserName(data.user.email.split('@')[0]);
            })
          )
        )
    );

    // pacientes e alertas reais (com fallback demo)
    Promise.all([loadClinicPatients(), loadAlerts()]).then(([pr, alerts]) => {
      const ps = pr.patients;
      const critReais = alerts
        ? alerts.filter((a) => a.item.level === 'crit' && a.item.status === 'open').length
        : null;
      const withData = ps.filter((p) => p.hasData);
      const withAdh = ps.filter((p) => p.adherence > 0);
      const avgAdh = withAdh.length
        ? Math.round(withAdh.reduce((a, p) => a + p.adherence, 0) / withAdh.length)
        : 0;
      setPatients(ps);
      setStats({
        totalPatients: ps.length,
        activePatients: withData.filter((p) => p.syncHours <= 48).length,
        noSync: withData.filter((p) => p.syncHours > 48).length,
        lowAdherence: withAdh.filter((p) => p.adherence < 50).length,
        critAlerts: critReais ?? 0,
        weeklyEvolution: avgAdh,
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const A = useMemo(
    () => ({
      steps: aggregate(patients, 'steps'),
      calories: aggregate(patients, 'calories'),
      sleep: aggregate(patients, 'sleep'),
    }),
    [patients],
  );
  const dataPatients = useMemo(() => patients.filter((p) => p.hasData), [patients]);
  const adhPatients = useMemo(() => patients.filter((p) => p.adherence > 0), [patients]);
  const hasAny = dataPatients.length > 0;
  const dist = useMemo(
    () => [
      { label: 'Alta · 80–100', value: adhPatients.filter((p) => p.adherence >= 80).length, color: 'var(--good)' },
      { label: 'Média · 50–79', value: adhPatients.filter((p) => p.adherence >= 50 && p.adherence < 80).length, color: 'var(--warn)' },
      { label: 'Baixa · 0–49', value: adhPatients.filter((p) => p.adherence < 50).length, color: 'var(--crit)' },
    ],
    [adhPatients],
  );
  const avgAdh = adhPatients.length ? Math.round(adhPatients.reduce((a, p) => a + p.adherence, 0) / adhPatients.length) : null;
  const avgSleep = hasAny ? (dataPatients.reduce((a, p) => a + p.sleep, 0) / dataPatients.length).toFixed(1) : null;

  const goPatients = (f?: string) => router.push('/clinica/pacientes' + (f ? `?filter=${f}` : ''));
  const goPatient = (id: string) => router.push(`/clinica/pacientes/${id}`);

  const noWearable = (
    <EmptyState
      icon="wifiOff"
      title="Sem dados de wearable"
      desc="Os gráficos aparecem quando os pacientes conectam o dispositivo e os dados sincronizam."
    />
  );

  const charts = (
    <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', alignItems: 'start' }}>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <ChartCard title="Atividade geral" sub="Passos médios/dia · 14 dias">
          {A.steps.length ? <LineChart data={A.steps} color="var(--c-steps)" height={140} unit=" passos" /> : noWearable}
        </ChartCard>
        <ChartCard title="Calorias ativas" sub="Média da clínica · 14 dias">
          {A.calories.length ? <BarChart data={A.calories} color="var(--c-cal)" height={140} unit=" kcal" /> : noWearable}
        </ChartCard>
      </div>
      <ChartCard title="Distribuição de aderência" sub={adhPatients.length + ' com aderência'}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '6px 0' }}>
          <div style={{ position: 'relative' }}>
            <Donut segments={dist} size={150} stroke={20} />
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
              <div>
                <div className="tnum" style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>{avgAdh ?? '—'}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 700 }}>média geral</div>
              </div>
            </div>
          </div>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dist.map((d, i) => (
              <div key={i} className="between" style={{ gap: 10 }}>
                <div className="row gap8 grow" style={{ minWidth: 0 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</span>
                </div>
                <span className="tnum" style={{ fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </ChartCard>
    </div>
  );

  const sleepCard = (
    <ChartCard
      title="Sono médio da clínica"
      sub="Horas por noite · 14 dias"
      right={<span className="badge neutral">{avgSleep ? avgSleep + 'h média' : 'sem dados'}</span>}
      legend={
        A.sleep.length ? (
          <div className="row gap16" style={{ marginTop: 8, fontSize: 11, color: 'var(--text-faint)' }}>
            <span className="row gap6"><span style={{ width: 14, height: 2, background: 'var(--c-sleep)', borderRadius: 2 }} />Realizado</span>
            <span className="row gap6"><span style={{ width: 14, height: 0, borderTop: '2px dashed var(--text-faint)' }} />Meta 7.5h</span>
          </div>
        ) : undefined
      }
    >
      {A.sleep.length ? <LineChart data={A.sleep} color="var(--c-sleep)" height={130} goal={7.5} fmtV={(v) => v + 'h'} yPad={0.25} /> : noWearable}
    </ChartCard>
  );

  return (
    <div className="page page-wide">
      <div className="between" style={{ marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Painel da clínica · {todayLabel()}</div>
          <h2 className="page-title">{greeting()}{userName ? `, ${userName}` : ''} 👋</h2>
          <div className="muted" style={{ marginTop: 2 }}>{'Visão consolidada de ' + stats.totalPatients + ' pacientes monitorados via wearables.'}</div>
        </div>
        <div className="row gap8">
          <div className="seg">
            <button className="active">7 dias</button>
            <button>14 dias</button>
            <button>30 dias</button>
          </div>
          <button className="btn ghost"><Icon n="download" size={16} />Exportar</button>
          <button className="btn primary" onClick={() => router.push('/clinica/relatorios')}><Icon n="sparkle" size={16} />Relatório IA</button>
        </div>
      </div>

      {loading ? (
        <div className="grid">
          <LoadingSkeleton variant="metric" count={6} />
          <LoadingSkeleton variant="row" count={4} />
        </div>
      ) : patients.length === 0 ? (
        <div className="card fade-in">
          <EmptyState
            icon="users"
            title="Nenhum paciente ainda"
            desc="Cadastre os primeiros pacientes para acompanhar a evolução da clínica no painel."
            action={
              <button className="btn primary" style={{ marginTop: 12 }} onClick={() => router.push('/clinica/pacientes')}>
                <Icon n="plus" size={16} />
                Ir para pacientes
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid fade-in">
          <KpiStrip c={stats} goPatients={goPatients} goAlerts={() => router.push('/clinica/alertas')} />
          {charts}
          <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', alignItems: 'start' }}>
            {hasAny ? (
              <PriorityList patients={dataPatients} goPatients={() => router.push('/clinica/pacientes')} goPatient={goPatient} />
            ) : (
              <div className="card">
                <EmptyState
                  icon="pulse"
                  title="Sem dados de pacientes"
                  desc="A lista de prioridades aparece quando há dados de wearable sincronizados."
                />
              </div>
            )}
            {sleepCard}
          </div>
        </div>
      )}
    </div>
  );
}
