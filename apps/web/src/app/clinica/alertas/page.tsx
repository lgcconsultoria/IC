'use client';
/* IC Clínica — Central de alertas */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons';
import { AlertCard, EmptyState } from '@/components/ui';
import { DATA, type AlertLevel } from '@/lib/clinic-data';

type LevelFilter = AlertLevel | 'all';

export default function AlertsPage() {
  const router = useRouter();
  const [level, setLevel] = useState<LevelFilter>('all');
  const [statusTab, setStatusTab] = useState<'open' | 'resolved'>('open');
  const [resolved, setResolved] = useState<Set<string>>(() => new Set(DATA.alerts.filter((a) => a.status === 'resolved').map((a) => a.id)));

  const all = DATA.alerts;
  const levelCounts: Record<LevelFilter, number> = {
    all: all.filter((a) => !resolved.has(a.id)).length,
    crit: all.filter((a) => a.level === 'crit' && !resolved.has(a.id)).length,
    warn: all.filter((a) => a.level === 'warn' && !resolved.has(a.id)).length,
    info: all.filter((a) => a.level === 'info' && !resolved.has(a.id)).length,
  };
  const list = all.filter((a) => {
    const isResolved = resolved.has(a.id);
    if (statusTab === 'open' && isResolved) return false;
    if (statusTab === 'resolved' && !isResolved) return false;
    if (level !== 'all' && a.level !== level) return false;
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
          </div>
        </div>
        <div className="seg">
          <button className={statusTab === 'open' ? 'active' : ''} onClick={() => setStatusTab('open')}>Abertos</button>
          <button className={statusTab === 'resolved' ? 'active' : ''} onClick={() => setStatusTab('resolved')}>Resolvidos</button>
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

      {list.length === 0 ? (
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
          {list.map((a) => (
            <AlertCard
              key={a.id}
              a={{ ...a, status: resolved.has(a.id) ? 'resolved' : 'open' }}
              onOpen={(pp) => router.push(`/clinica/pacientes/${pp.id}`)}
              onResolve={(aa) => setResolved((s) => new Set([...s, aa.id]))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
