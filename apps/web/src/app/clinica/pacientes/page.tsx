'use client';
/* IC Clínica — Lista de pacientes (API real + fallback demo) */
import { Suspense, useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/icons';
import { Ring, Sparkline } from '@/components/charts';
import { Avatar, DeviceBadge, PatientCard, PerfBadge, adhColor, syncLabel, EmptyState } from '@/components/ui';
import { DEVICES, fmt, type Patient } from '@/lib/clinic-data';
import { loadClinicPatients, type DataSource } from '@/lib/patient-source';

const FILTERS = [
  { key: 'baixa-atividade', label: 'Baixa atividade', icon: 'foot' },
  { key: 'sem-treino', label: 'Sem treino', icon: 'dumbbell' },
  { key: 'sono-ruim', label: 'Sono ruim', icon: 'moon' },
  { key: 'sem-sync', label: 'Sem sincronização', icon: 'wifiOff' },
  { key: 'meta-nao-atingida', label: 'Meta não atingida', icon: 'target' },
  { key: 'alta-performance', label: 'Alta performance', icon: 'sparkle' },
];

function load<T>(k: string, d: T): T {
  try {
    const v = localStorage.getItem(k);
    return v == null ? d : (JSON.parse(v) as T);
  } catch {
    return d;
  }
}
function save<T>(k: string, v: T) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* noop */
  }
}

function PatientsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get('filter');

  const [all, setAll] = useState<Patient[]>([]);
  const [source, setSource] = useState<DataSource>('demo');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [active, setActive] = useState<string[]>(() => (initialFilter ? [initialFilter] : load('ic_filters', [])));
  const [view, setView] = useState<'table' | 'cards'>(() => load('ic_pview', 'table'));
  const [sort, setSort] = useState<'adherence' | 'name' | 'steps' | 'sync'>('adherence');

  useEffect(() => {
    let alive = true;
    loadClinicPatients().then((r) => {
      if (!alive) return;
      setAll(r.patients);
      setSource(r.source);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => save('ic_filters', active), [active]);
  useEffect(() => save('ic_pview', view), [view]);
  useEffect(() => {
    if (initialFilter) setActive([initialFilter]);
  }, [initialFilter]);

  function toggle(k: string) {
    setActive((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    FILTERS.forEach((f) => (c[f.key] = all.filter((p) => p.tags.includes(f.key)).length));
    return c;
  }, [all]);

  const list = useMemo(() => {
    const l = all.filter(
      (p) => (!q || p.name.toLowerCase().includes(q.toLowerCase())) && (active.length === 0 || active.every((f) => p.tags.includes(f))),
    );
    const s = {
      adherence: (a: Patient, b: Patient) => a.adherence - b.adherence,
      name: (a: Patient, b: Patient) => a.name.localeCompare(b.name),
      steps: (a: Patient, b: Patient) => b.steps - a.steps,
      sync: (a: Patient, b: Patient) => b.syncHours - a.syncHours,
    };
    return [...l].sort(s[sort]);
  }, [q, active, sort, all]);

  const open = (id: string) => router.push(`/clinica/pacientes/${id}`);

  return (
    <div className="page page-wide">
      <div className="between" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title">Pacientes</h2>
          <div className="muted" style={{ marginTop: 2 }}>
            {loading ? 'Carregando…' : list.length + ' de ' + all.length + ' pacientes' + (active.length ? ' · ' + active.length + ' filtro(s) ativo(s)' : '')}
          </div>
        </div>
        <div className="row gap8">
          <div className="seg">
            <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
              <Icon n="grid" size={14} style={{ transform: 'scaleY(.6)' }} /> Tabela
            </button>
            <button className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')}>
              <Icon n="grid" size={14} /> Cards
            </button>
          </div>
          <button className="btn primary">
            <Icon n="plus" size={16} />
            Novo paciente
          </button>
        </div>
      </div>

      {!loading && (
        <div className="card card-pad" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: source === 'api' ? 'var(--good-soft)' : 'var(--surface-2)' }}>
          <Icon n={source === 'api' ? 'sync' : 'info'} size={15} style={{ color: source === 'api' ? 'var(--good)' : 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {source === 'api'
              ? 'Pacientes carregados da API. Métricas de wearable são demonstrativas até a sincronização via Terra.'
              : 'Modo demonstração — dados fictícios. Conecte a API e cadastre pacientes para ver dados reais.'}
          </span>
        </div>
      )}

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="row gap12" style={{ flexWrap: 'wrap' }}>
          <div className="search" style={{ flex: 1, minWidth: 220 }}>
            <Icon n="search" size={16} />
            <input placeholder="Buscar por nome…" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && (
              <button onClick={() => setQ('')} style={{ display: 'grid', color: 'var(--text-faint)' }}>
                <Icon n="x" size={14} />
              </button>
            )}
          </div>
          <div className="row gap8">
            <span style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 600 }}>Ordenar:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              style={{ padding: '8px 11px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 600 }}
            >
              <option value="adherence">Menor aderência</option>
              <option value="name">Nome (A–Z)</option>
              <option value="steps">Mais passos</option>
              <option value="sync">Sync mais antiga</option>
            </select>
          </div>
        </div>
        <div className="row gap8 wrap" style={{ marginTop: 14 }}>
          {FILTERS.map((f) => (
            <button key={f.key} className={'chip' + (active.includes(f.key) ? ' active' : '')} onClick={() => toggle(f.key)}>
              <Icon n={f.icon} size={13} />
              {f.label}
              <span className="cnt">{counts[f.key] ?? 0}</span>
            </button>
          ))}
          {active.length > 0 && (
            <button className="chip" style={{ color: 'var(--crit)' }} onClick={() => setActive([])}>
              <Icon n="x" size={13} />
              Limpar
            </button>
          )}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="search"
            title="Nenhum paciente encontrado"
            desc="Ajuste os filtros ou o termo de busca para ver resultados."
            action={
              <button
                className="btn soft"
                style={{ marginTop: 12 }}
                onClick={() => {
                  setQ('');
                  setActive([]);
                }}
              >
                Limpar filtros
              </button>
            }
          />
        </div>
      ) : view === 'cards' ? (
        <div className="grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
          {list.map((p) => (
            <PatientCard key={p.id} p={p} onOpen={(pp) => open(pp.id)} />
          ))}
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  {['Paciente', 'Dispositivo', 'Última sync', 'Aderência', 'Passos (14d)', 'Calorias/sem', 'Treinos', 'Sono', 'Status'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} onClick={() => open(p.id)}>
                    <td>
                      <div className="row gap10">
                        <Avatar p={p} size={34} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{p.age + ' anos · ' + (p.sex === 'f' ? 'Fem' : 'Masc')}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="row gap8">
                        <DeviceBadge device={p.device} size={26} />
                        <span style={{ fontSize: 12.5 }} className="hide-sm">{DEVICES[p.device].name}</span>
                      </div>
                    </td>
                    <td>
                      {p.syncHours > 48 ? (
                        <span className="badge crit">
                          <span className="bdot" />
                          {syncLabel(p.syncHours)}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{syncLabel(p.syncHours)}</span>
                      )}
                    </td>
                    <td>
                      <div className="row gap8">
                        <Ring value={p.adherence} size={30} stroke={4} color={adhColor(p.adherence)}>
                          <span className="tnum" style={{ fontSize: 10.5, fontWeight: 800 }}>{p.adherence}</span>
                        </Ring>
                      </div>
                    </td>
                    <td>
                      <div className="row gap10">
                        <Sparkline data={p.s.steps} color={adhColor(p.adherence)} width={64} height={24} />
                        <span className="tnum" style={{ fontSize: 12.5, fontWeight: 600 }}>{fmt(p.steps)}</span>
                      </div>
                    </td>
                    <td className="tnum" style={{ fontWeight: 600 }}>{fmt(p.calories)}</td>
                    <td className="tnum">{p.workouts}</td>
                    <td className="tnum" style={{ color: p.sleep < 6.2 ? 'var(--crit)' : 'var(--text)' }}>{p.sleep + 'h'}</td>
                    <td>
                      <PerfBadge perf={p.perf} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PatientsPage() {
  return (
    <Suspense fallback={<div className="page page-wide" />}>
      <PatientsInner />
    </Suspense>
  );
}
