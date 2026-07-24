'use client';
/* IC Clínica — Dashboard */
import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons';
import { LineChart, BarChart, Donut, Ring } from '@/components/charts';
import { MetricCard, Avatar, adhColor, syncLabel, LoadingSkeleton } from '@/components/ui';
import { DATA, fmt, type Patient } from '@/lib/clinic-data';
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
  const kpis = [
    { icon: 'users', label: 'Total de pacientes', value: c.totalPatients, accent: 'var(--accent)', trend: 4, sub: '3 novos esta semana' },
    { icon: 'pulse', label: 'Pacientes ativos', value: c.activePatients, accent: 'var(--info)', trend: 6, sub: 'sincronizando < 48h' },
    { icon: 'wifiOff', label: 'Sem sincronização', value: c.noSync, accent: 'var(--warn)', trend: 12, trendInvert: true, sub: 'precisam reconectar', go: () => goPatients('sem-sync') },
    { icon: 'trend', label: 'Baixa aderência', value: c.lowAdherence, accent: 'var(--crit)', trend: -8, trendInvert: true, sub: '< 50% de meta', go: () => goPatients('baixa-aderencia') },
    { icon: 'warn', label: 'Alertas críticos', value: c.critAlerts, accent: 'var(--crit)', trend: -2, trendInvert: true, sub: 'requerem ação', go: goAlerts },
    { icon: 'sparkle', label: 'Evolução semanal', value: '+' + c.weeklyEvolution + '%', accent: 'var(--good)', trend: c.weeklyEvolution, sub: 'aderência média da clínica' },
  ];
  return (
    <div className="metrics-grid stagger">
      {kpis.map((k, i) => (
        <MetricCard key={i} icon={k.icon} label={k.label} value={k.value} accent={k.accent} trend={k.trend} trendInvert={k.trendInvert} sub={k.sub} onClick={k.go} />
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
                <div style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 50, background: adhColor(p.adherence), border: '2px solid var(--surface)' }} />
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
              <Ring value={p.adherence} size={38} stroke={4.5} color={adhColor(p.adherence)}>
                <span className="tnum" style={{ fontSize: 12, fontWeight: 800 }}>{p.adherence}</span>
              </Ring>
              <Icon n="chevR" size={16} style={{ color: 'var(--text-faint)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const ALLOW_DEMO = process.env.NEXT_PUBLIC_ALLOW_DEMO === 'true';

function aggregate(patients: Patient[], key: 'steps' | 'calories' | 'sleep') {
  if (patients.length === 0) return ALLOW_DEMO ? DATA.agg[key] : [];
  const ref = patients[0]!.s[key];
  const dec = key === 'sleep';
  return ref.map((point, idx) => {
    const sum = patients.reduce((a, p) => a + (p.s[key][idx]?.value ?? 0), 0);
    const v = sum / patients.length;
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
  const [patients, setPatients] = useState<Patient[]>(DATA.patients);
  const [stats, setStats] = useState<ClinicStats>(DATA.clinic);

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
      setPatients(ps);
      setStats({
        totalPatients: ps.length,
        activePatients: ps.filter((p) => p.syncHours <= 48).length,
        noSync: ps.filter((p) => p.syncHours > 48).length,
        lowAdherence: ps.filter((p) => p.adherence < 50).length,
        critAlerts: critReais ?? DATA.clinic.critAlerts,
        weeklyEvolution: DATA.clinic.weeklyEvolution,
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
  const dist = useMemo(
    () => [
      { label: 'Alta · 80–100', value: patients.filter((p) => p.adherence >= 80).length, color: 'var(--good)' },
      { label: 'Média · 50–79', value: patients.filter((p) => p.adherence >= 50 && p.adherence < 80).length, color: 'var(--warn)' },
      { label: 'Baixa · 0–49', value: patients.filter((p) => p.adherence < 50).length, color: 'var(--crit)' },
    ],
    [patients],
  );
  const avgAdh = patients.length ? Math.round(patients.reduce((a, p) => a + p.adherence, 0) / patients.length) : 67;
  const avgSleep = patients.length ? (patients.reduce((a, p) => a + p.sleep, 0) / patients.length).toFixed(1) : '7.0';

  const goPatients = (f?: string) => router.push('/clinica/pacientes' + (f ? `?filter=${f}` : ''));
  const goPatient = (id: string) => router.push(`/clinica/pacientes/${id}`);

  const charts = (
    <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', alignItems: 'start' }}>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <ChartCard title="Atividade geral" sub="Passos médios/dia · 14 dias" right={<span className="trend up"><Icon n="arrUp" size={13} />8%</span>}>
          <LineChart data={A.steps} color="var(--c-steps)" height={140} unit=" passos" />
        </ChartCard>
        <ChartCard title="Calorias ativas" sub="Média da clínica · 14 dias" right={<span className="trend up"><Icon n="arrUp" size={13} />5%</span>}>
          <BarChart data={A.calories} color="var(--c-cal)" height={140} unit=" kcal" />
        </ChartCard>
      </div>
      <ChartCard title="Distribuição de aderência" sub={stats.totalPatients + ' pacientes'}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '6px 0' }}>
          <div style={{ position: 'relative' }}>
            <Donut segments={dist} size={150} stroke={20} />
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
              <div>
                <div className="tnum" style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>{avgAdh}</div>
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
      right={<span className="badge neutral">{avgSleep}h média</span>}
      legend={
        <div className="row gap16" style={{ marginTop: 8, fontSize: 11, color: 'var(--text-faint)' }}>
          <span className="row gap6"><span style={{ width: 14, height: 2, background: 'var(--c-sleep)', borderRadius: 2 }} />Realizado</span>
          <span className="row gap6"><span style={{ width: 14, height: 0, borderTop: '2px dashed var(--text-faint)' }} />Meta 7.5h</span>
        </div>
      }
    >
      <LineChart data={A.sleep} color="var(--c-sleep)" height={130} goal={7.5} fmtV={(v) => v + 'h'} yPad={0.25} />
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
      ) : (
        <div className="grid fade-in">
          <KpiStrip c={stats} goPatients={goPatients} goAlerts={() => router.push('/clinica/alertas')} />
          {charts}
          <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', alignItems: 'start' }}>
            <PriorityList patients={patients} goPatients={() => router.push('/clinica/pacientes')} goPatient={goPatient} />
            {sleepCard}
          </div>
        </div>
      )}
    </div>
  );
}
