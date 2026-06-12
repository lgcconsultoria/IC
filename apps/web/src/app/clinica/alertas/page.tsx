'use client';
/* IC Clínica — Central de alertas (API real com fallback demo) */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons';
import { AlertCard, EmptyState } from '@/components/ui';
import { DATA, type AlertItem, type AlertLevel, type Patient } from '@/lib/clinic-data';
import { loadAlerts, resolveAlert, refreshAlerts } from '@/lib/alerts-source';

type LevelFilter = AlertLevel | 'all';
interface Entry { item: AlertItem; patient?: Patient }

export default function AlertsPage() {
  const router = useRouter();
  const [level, setLevel] = useState<LevelFilter>('all');
  const [statusTab, setStatusTab] = useState<'open' | 'resolved'>('open');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [usingReal, setUsingReal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    const real = await loadAlerts();
    if (real && real.length > 0) {
      setEntries(real.map((x) => ({ item: x.item, patient: x.patient })));
      setUsingReal(true);
      setResolved(new Set(real.filter((x) => x.item.status === 'resolved').map((x) => x.item.id)));
    } else {
      setEntries(DATA.alerts.map((a) => ({ item: a })));
      setUsingReal(false);
      setResolved(new Set(DATA.alerts.filter((a) => a.status === 'resolved').map((a) => a.id)));
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await refreshAlerts();
    await load();
    setRefreshing(false);
  }

  function handleResolve(id: string) {
    setResolved((s) => new Set([...s, id]));
    if (usingReal) void resolveAlert(id);
  }

  const levelCounts = useMemo<Record<LevelFilter, number>>(() => {
    const open = entries.filter((e) => !resolved.has(e.item.id));
    return {
      all: open.length,
      crit: open.filter((e) => e.item.level === 'crit').length,
      warn: open.filter((e) => e.item.level === 'warn').length,
      info: open.filter((e) => e.item.level === 'info').length,
    };
  }, [entries, resolved]);

  const list = entries.filter((e) => {
    const isResolved = resolved.has(e.item.id);
    if (statusTab === 'open' && isResolved) return false;
    if (statusTab === 'resolved' && !isResolved) return false;
    if (level !== 'all' && e.item.level !== level) return false;
    return true;
  });

  const levels: [LevelFilter, string, string, string][] = [
    ['all', 'Todos', 'bell', 'neutral'],
    ['crit', 'Críticos', 'warn', 'crit'],
    ['warn', 'Atenção', 'info', 'warn'],
    ['info', 'Informativos', 'sparkle', 'info'],
  ];

  return (
    <div className="page">
      <div className="between" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title">Central de alertas</h2>
          <div className="muted" style={{ marginTop: 2 }}>
            {levelCounts.crit + ' críticos · ' + levelCounts.warn + ' de atenção · ' + levelCounts.info + ' informativos'}
            <span className={'badge ' + (usingReal ? 'good' : 'neutral')} style={{ marginLeft: 8 }}>
              <span className="bdot" />
              {usingReal ? 'tempo real' : 'demonstrativo'}
            </span>
          </div>
        </div>
        <div className="row gap8">
          <button className="btn ghost sm" onClick={handleRefresh} disabled={refreshing}>
            <Icon n="sync" size={15} />
            {refreshing ? 'Atualizando…' : 'Gerar alertas'}
          </button>
          <div className="seg">
            <button className={statusTab === 'open' ? 'active' : ''} onClick={() => setStatusTab('open')}>Abertos</button>
            <button className={statusTab === 'resolved' ? 'active' : ''} onClick={() => setStatusTab('resolved')}>Resolvidos</button>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 18 }}>
        {levels.map(([k, lbl, ic, col]) => (
          <button
            key={k}
            onClick={() => setLevel(k)}
            className="card card-pad"
            style={{ textAlign: 'left', cursor: 'pointer', borderColor: level === k ? 'var(--' + (col === 'neutral' ? 'accent' : col) + ')' : 'var(--border)', borderWidth: level === k ? 2 : 1, padding: 15 }}
          >
            <div className="between">
              <div style={{ width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', background: col === 'neutral' ? 'var(--surface-2)' : 'var(--' + col + '-soft)', color: col === 'neutral' ? 'var(--text-muted)' : 'var(--' + col + ')' }}>
                <Icon n={ic} size={16} />
              </div>
              <span className="tnum" style={{ fontSize: 24, fontWeight: 800 }}>{levelCounts[k]}</span>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', marginTop: 10 }}>{lbl}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid" style={{ gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="card card-pad"><div className="skel" style={{ height: 60 }} /></div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={statusTab === 'resolved' ? 'check' : 'shield'}
            title={statusTab === 'resolved' ? 'Nenhum alerta resolvido ainda' : 'Tudo sob controle ✨'}
            desc={
              statusTab === 'resolved'
                ? 'Alertas resolvidos aparecerão aqui para histórico.'
                : 'Não há alertas ' + (level !== 'all' ? 'desse nível ' : '') + 'abertos no momento. Continue o bom trabalho!'
            }
          />
        </div>
      ) : (
        <div className="grid stagger" style={{ gap: 12 }}>
          {list.map((e) => (
            <AlertCard
              key={e.item.id}
              a={{ ...e.item, status: resolved.has(e.item.id) ? 'resolved' : 'open' }}
              patient={e.patient}
              onOpen={(pp) => router.push(`/clinica/pacientes/${pp.id}`)}
              onResolve={(aa) => handleResolve(aa.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
