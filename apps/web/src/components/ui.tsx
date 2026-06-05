'use client';
/* IC Clínica — Componentes de UI reutilizáveis. */
import { useState, type ReactNode } from 'react';
import { Icon } from './icons';
import { Sparkline, Ring, CompareBar } from './charts';
import {
  DEVICES,
  fmt,
  byId,
  timelineFor,
  type Patient,
  type AlertItem,
  type Perf,
  type SeriesPoint,
  type DeviceKey,
} from '@/lib/clinic-data';

// ---- helpers -------------------------------------------------------------
export function Avatar({ p, size = 38 }: { p: Patient; size?: number }) {
  return (
    <div className="avatar" style={{ width: size, height: size, background: p.color, fontSize: size * 0.38 }}>
      {p.initials}
    </div>
  );
}

export function DeviceBadge({ device, size = 30 }: { device: DeviceKey; size?: number }) {
  const d = DEVICES[device];
  return (
    <div className="dev" title={d.name} style={{ width: size, height: size, background: d.color, fontSize: size * 0.4 }}>
      {d.mono || d.name[0]}
    </div>
  );
}

export function Trend({ value, suffix = '%', invert = false, size }: { value: number; suffix?: string; invert?: boolean; size?: number }) {
  const up = value > 0,
    flat = value === 0;
  const good = invert ? !up : up;
  const cls = flat ? 'flat' : good ? 'up' : 'down';
  return (
    <span className={'trend ' + cls} style={size ? { fontSize: size } : undefined}>
      {!flat && <Icon n={up ? 'arrUp' : 'arrDn'} size={13} />}
      {(up ? '+' : '') + value + suffix}
    </span>
  );
}

const PERF: Record<Perf, { cls: string; label: string }> = {
  high: { cls: 'good', label: 'Alta performance' },
  mid: { cls: 'warn', label: 'Atenção' },
  low: { cls: 'crit', label: 'Risco' },
};

export function PerfBadge({ perf }: { perf: Perf }) {
  const m = PERF[perf];
  return (
    <span className={'badge ' + m.cls}>
      <span className="bdot" />
      {m.label}
    </span>
  );
}

export function adhColor(a: number): string {
  return a >= 80 ? 'var(--good)' : a >= 50 ? 'var(--warn)' : 'var(--crit)';
}

export function syncLabel(h: number): string {
  return h < 1 ? 'agora' : h < 24 ? 'há ' + h + 'h' : 'há ' + Math.round(h / 24) + 'd';
}

// ---- MetricCard ----------------------------------------------------------
interface MetricCardProps {
  icon: string;
  label: string;
  value: ReactNode;
  unit?: string;
  trend?: number;
  trendInvert?: boolean;
  accent?: string;
  spark?: SeriesPoint[];
  sparkColor?: string;
  sub?: ReactNode;
  onClick?: () => void;
}

export function MetricCard({ icon, label, value, unit, trend, trendInvert, accent = 'var(--accent)', spark, sparkColor, sub, onClick }: MetricCardProps) {
  return (
    <div className="card card-pad" style={{ cursor: onClick ? 'pointer' : 'default', position: 'relative', overflow: 'hidden' }} onClick={onClick}>
      <div className="between" style={{ marginBottom: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'color-mix(in oklch, ' + accent + ' 14%, transparent)', color: accent }}>
          <Icon n={icon} size={18} />
        </div>
        {trend != null && <Trend value={trend} invert={trendInvert} />}
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      <div className="between" style={{ alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span className="tnum" style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {value}
          </span>
          {unit && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-faint)' }}>{unit}</span>}
        </div>
        {spark && <Sparkline data={spark} color={sparkColor || accent} width={80} height={30} />}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 8 }}>{sub}</div>}
    </div>
  );
}

// ---- AdherenceScore ------------------------------------------------------
export function AdherenceScore({ value, size = 92, showLabel = true, stroke = 9 }: { value: number; size?: number; showLabel?: boolean; stroke?: number }) {
  const col = adhColor(value);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <Ring value={value} size={size} stroke={stroke} color={col}>
        <div style={{ textAlign: 'center' }}>
          <div className="tnum" style={{ fontSize: size * 0.3, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>
            {value}
          </div>
          <div style={{ fontSize: size * 0.1, color: 'var(--text-faint)', fontWeight: 700 }}>/ 100</div>
        </div>
      </Ring>
      {showLabel && (
        <div style={{ fontSize: 11.5, fontWeight: 700, color: col }}>{value >= 80 ? 'Excelente' : value >= 50 ? 'Regular' : 'Baixa'}</div>
      )}
    </div>
  );
}

// ---- PatientCard ---------------------------------------------------------
export function PatientCard({ p, onOpen }: { p: Patient; onOpen: (p: Patient) => void }) {
  const stale = p.syncHours > 48;
  const metrics: [string, ReactNode, string][] = [
    ['foot', fmt(p.steps), 'passos'],
    ['flame', fmt(p.calories), 'kcal'],
    ['dumbbell', p.workouts, 'treinos'],
    ['moon', p.sleep + 'h', 'sono'],
  ];
  return (
    <div
      className="card"
      style={{ padding: 16, cursor: 'pointer', transition: 'box-shadow .15s, transform .12s, border-color .15s' }}
      onClick={() => onOpen(p)}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        e.currentTarget.style.borderColor = 'var(--border-strong)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.transform = 'none';
      }}
    >
      <div className="between" style={{ marginBottom: 14 }}>
        <div className="row gap10">
          <Avatar p={p} size={42} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em' }}>{p.name}</div>
            <div className="row gap6" style={{ marginTop: 2 }}>
              <DeviceBadge device={p.device} size={16} />
              <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{DEVICES[p.device].name}</span>
            </div>
          </div>
        </div>
        <Ring value={p.adherence} size={46} stroke={5} color={adhColor(p.adherence)}>
          <span className="tnum" style={{ fontSize: 14, fontWeight: 800 }}>
            {p.adherence}
          </span>
        </Ring>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
        {metrics.map((m, i) => (
          <div key={i} style={{ textAlign: 'center', padding: '7px 2px', background: 'var(--surface-2)', borderRadius: 9 }}>
            <div className="tnum" style={{ fontSize: 14, fontWeight: 700 }}>
              {m[1]}
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--text-faint)', fontWeight: 600, marginTop: 1 }}>{m[2]}</div>
          </div>
        ))}
      </div>
      <div className="between">
        {stale ? (
          <span className="badge crit">
            <Icon n="wifiOff" size={12} />
            {'Sem sync ' + syncLabel(p.syncHours)}
          </span>
        ) : (
          <span className="badge neutral">
            <Icon n="sync" size={12} />
            {syncLabel(p.syncHours)}
          </span>
        )}
        {p.alertCount > 0 && (
          <span className="badge warn">
            <Icon n="bell" size={12} />
            {p.alertCount}
          </span>
        )}
      </div>
    </div>
  );
}

// ---- AlertCard -----------------------------------------------------------
const ALV: Record<string, { cls: string; icon: string; label: string }> = {
  crit: { cls: 'crit', icon: 'warn', label: 'Crítico' },
  warn: { cls: 'warn', icon: 'info', label: 'Atenção' },
  info: { cls: 'info', icon: 'sparkle', label: 'Informativo' },
};

export function AlertCard({ a, onOpen, onResolve, compact }: { a: AlertItem; onOpen?: (p: Patient) => void; onResolve?: (a: AlertItem) => void; compact?: boolean }) {
  const m = ALV[a.level]!;
  const p = byId(a.patient);
  const [done, setDone] = useState(a.status === 'resolved');
  if (!p) return null;
  return (
    <div
      className="card"
      style={{
        padding: compact ? 14 : 16,
        opacity: done ? 0.6 : 1,
        transition: 'opacity .3s',
        borderLeft: '3px solid var(--' + (a.level === 'crit' ? 'crit' : a.level === 'warn' ? 'warn' : 'info') + ')',
      }}
    >
      <div className="row gap12" style={{ alignItems: 'flex-start' }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--' + m.cls + '-soft)', color: 'var(--' + m.cls + ')' }}>
          <Icon n={m.icon} size={17} />
        </div>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="between" style={{ gap: 8 }}>
            <div className="row gap8 wrap">
              <span className={'badge ' + m.cls}>{m.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{a.agoLabel}</span>
            </div>
            {!compact && (
              <button className="icon-btn" style={{ width: 28, height: 28 }}>
                <Icon n="more" size={16} />
              </button>
            )}
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, margin: '7px 0 3px' }}>{a.title}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{a.desc}</div>
          {!compact && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, padding: '9px 11px', background: 'var(--surface-2)', borderRadius: 9 }}>
              <Icon n="sparkle" size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-ink)' }}>Ação sugerida · </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.action}</span>
              </div>
            </div>
          )}
          <div className="between" style={{ marginTop: 12 }}>
            <div className="row gap8" style={{ cursor: 'pointer' }} onClick={() => onOpen && onOpen(p)}>
              <Avatar p={p} size={24} />
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{p.name}</span>
            </div>
            <div className="row gap8">
              <button className="btn ghost sm" onClick={() => onOpen && onOpen(p)}>
                Abrir paciente
                <Icon n="arrowRight" size={14} />
              </button>
              {!done && (
                <button
                  className="btn soft sm"
                  onClick={() => {
                    setDone(true);
                    onResolve && onResolve(a);
                  }}
                >
                  <Icon n="check" size={14} />
                  Resolver
                </button>
              )}
              {done && (
                <span className="badge good">
                  <Icon n="check" size={12} />
                  Resolvido
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- DeviceConnectionStatus ----------------------------------------------
export function DeviceConnectionStatus({ device, status, lastSync }: { device: DeviceKey; status: string; lastSync?: string }) {
  const d = DEVICES[device];
  const map: Record<string, [string, string]> = {
    connected: ['good', 'Conectado'],
    pending: ['warn', 'Aguardando'],
    error: ['crit', 'Erro de sync'],
    off: ['neutral', 'Desconectado'],
  };
  const [cls, label] = map[status] || map.off!;
  return (
    <div className="row gap12" style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
      <DeviceBadge device={device} size={38} />
      <div className="grow">
        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{d.name}</div>
        {lastSync && <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{'Última sync ' + lastSync}</div>}
      </div>
      <span className={'badge ' + cls}>
        <span className="bdot" />
        {label}
      </span>
    </div>
  );
}

// ---- GoalProgress --------------------------------------------------------
export function GoalProgress({ icon, label, value, goal, unit, color = 'var(--accent)', invert }: { icon: string; label: string; value: number; goal: number; unit?: string; color?: string; invert?: boolean }) {
  const pct = Math.min(100, Math.round((value / goal) * 100));
  const hit = invert ? value <= goal : value >= goal;
  return (
    <div style={{ padding: '2px 0' }}>
      <div className="between" style={{ marginBottom: 7 }}>
        <div className="row gap8">
          <div style={{ width: 26, height: 26, borderRadius: 8, background: 'color-mix(in oklch,' + color + ' 14%, transparent)', color, display: 'grid', placeItems: 'center' }}>
            <Icon n={icon} size={14} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        </div>
        <div className="tnum" style={{ fontSize: 13 }}>
          <span style={{ fontWeight: 700 }}>{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</span>
          <span style={{ color: 'var(--text-faint)' }}>{' / ' + goal.toLocaleString('pt-BR') + (unit ? ' ' + unit : '')}</span>
        </div>
      </div>
      <div className="row gap10">
        <div className="grow">
          <CompareBar value={value} goal={invert ? value : goal} color={color} />
        </div>
        <span className="tnum" style={{ fontSize: 12, fontWeight: 700, width: 38, textAlign: 'right', color: hit ? 'var(--good)' : 'var(--text-muted)' }}>
          {pct + '%'}
        </span>
      </div>
    </div>
  );
}

// ---- PatientTimeline -----------------------------------------------------
const TLI: Record<string, [string, string]> = {
  sync: ['sync', 'var(--accent)'],
  workout: ['activity', 'var(--c-cal)'],
  goal: ['target', 'var(--good)'],
  sleep: ['moon', 'var(--c-sleep)'],
  note: ['note', 'var(--info)'],
  alert: ['bell', 'var(--warn)'],
};

export function PatientTimeline({ items }: { items: ReturnType<typeof timelineFor> }) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: 16, top: 10, bottom: 10, width: 2, background: 'var(--border)' }} />
      {items.map((it, i) => {
        const [ic, col] = TLI[it.type] || TLI.note!;
        return (
          <div key={i} className="row gap12" style={{ position: 'relative', paddingBottom: i === items.length - 1 ? 0 : 18, alignItems: 'flex-start' }}>
            <div style={{ width: 34, height: 34, borderRadius: 50, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--surface)', border: '2px solid var(--border)', color: col, zIndex: 1 }}>
              <Icon n={ic} size={15} />
            </div>
            <div className="grow" style={{ paddingTop: 2 }}>
              <div className="between">
                <span style={{ fontWeight: 600, fontSize: 13 }}>{it.title}</span>
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{it.t}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{it.desc}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- EmptyState ----------------------------------------------------------
export function EmptyState({ icon = 'search', title, desc, action }: { icon?: string; title: ReactNode; desc?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-ic">
        <Icon n={icon} size={26} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
      {desc && <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 320 }}>{desc}</div>}
      {action}
    </div>
  );
}

// ---- LoadingSkeleton -----------------------------------------------------
export function LoadingSkeleton({ variant = 'card', count = 1 }: { variant?: 'card' | 'metric' | 'row'; count?: number }) {
  const items = Array.from({ length: count });
  if (variant === 'metric')
    return (
      <div className="metrics-grid">
        {items.map((_, i) => (
          <div key={i} className="card card-pad">
            <div className="skel" style={{ width: 34, height: 34, borderRadius: 10, marginBottom: 14 }} />
            <div className="skel" style={{ width: '60%', height: 10, marginBottom: 10 }} />
            <div className="skel" style={{ width: '45%', height: 22 }} />
          </div>
        ))}
      </div>
    );
  if (variant === 'row')
    return (
      <div className="card" style={{ overflow: 'hidden' }}>
        {items.map((_, i) => (
          <div key={i} className="row gap12" style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
            <div className="skel" style={{ width: 38, height: 38, borderRadius: 50 }} />
            <div className="grow">
              <div className="skel" style={{ width: '30%', height: 12, marginBottom: 7 }} />
              <div className="skel" style={{ width: '20%', height: 10 }} />
            </div>
            <div className="skel" style={{ width: 60, height: 24, borderRadius: 8 }} />
          </div>
        ))}
      </div>
    );
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
      {items.map((_, i) => (
        <div key={i} className="card card-pad">
          <div className="row gap10" style={{ marginBottom: 14 }}>
            <div className="skel" style={{ width: 42, height: 42, borderRadius: 50 }} />
            <div className="grow">
              <div className="skel" style={{ width: '50%', height: 12, marginBottom: 6 }} />
              <div className="skel" style={{ width: '35%', height: 10 }} />
            </div>
          </div>
          <div className="skel" style={{ width: '100%', height: 56, borderRadius: 9 }} />
        </div>
      ))}
    </div>
  );
}

// ---- ConsentStatus -------------------------------------------------------
export function ConsentStatus({ granted, scopes }: { granted: boolean; scopes?: string[] | null }) {
  return (
    <div className="card card-pad" style={{ background: granted ? 'var(--good-soft)' : 'var(--surface-2)', border: '1px solid ' + (granted ? 'transparent' : 'var(--border)') }}>
      <div className="row gap10" style={{ marginBottom: scopes ? 10 : 0 }}>
        <Icon n={granted ? 'shield' : 'lock'} size={18} style={{ color: granted ? 'var(--good)' : 'var(--text-muted)' }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{granted ? 'Consentimento concedido' : 'Consentimento pendente'}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            {granted ? 'O paciente autorizou o compartilhamento dos dados abaixo.' : 'Aguardando autorização do paciente.'}
          </div>
        </div>
      </div>
      {scopes && (
        <div className="row gap6 wrap">
          {scopes.map((s) => (
            <span key={s} className="chip" style={{ fontSize: 11.5, padding: '3px 9px' }}>
              <Icon n="check" size={12} style={{ color: 'var(--good)' }} />
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- WeeklySummary -------------------------------------------------------
export function WeeklySummary({ p }: { p: Patient }) {
  const items = [
    { icon: 'foot', label: 'Passos/dia', v: fmt(p.steps), goal: '10.000', pct: Math.min(100, Math.round((p.steps / p.goalSteps) * 100)) },
    { icon: 'flame', label: 'Calorias ativas', v: fmt(p.calories), goal: '4.500/sem', pct: Math.min(100, Math.round((p.calories / p.goalCal) * 100)) },
    { icon: 'dumbbell', label: 'Treinos', v: String(p.workouts), goal: '5/sem', pct: Math.min(100, Math.round((p.workouts / p.goalWorkouts) * 100)) },
    { icon: 'moon', label: 'Sono médio', v: p.sleep + 'h', goal: '7.5h', pct: Math.min(100, Math.round((p.sleep / p.goalSleep) * 100)) },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
      {items.map((it, i) => (
        <div key={i} style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 11 }}>
          <div className="row gap8" style={{ color: 'var(--text-muted)', marginBottom: 6 }}>
            <Icon n={it.icon} size={14} />
            <span style={{ fontSize: 11.5, fontWeight: 600 }}>{it.label}</span>
          </div>
          <div className="between" style={{ alignItems: 'flex-end', marginBottom: 7 }}>
            <span className="tnum" style={{ fontSize: 19, fontWeight: 800 }}>
              {it.v}
            </span>
            <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>{'meta ' + it.goal}</span>
          </div>
          <div className="progress-track" style={{ height: 6 }}>
            <div className="progress-fill" style={{ width: it.pct + '%', background: it.pct >= 100 ? 'var(--good)' : it.pct >= 60 ? 'var(--accent)' : 'var(--warn)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
