'use client';
/* IC Clínica — Gráficos SVG com hover. */
import { useRef, useState, useLayoutEffect, type ReactNode } from 'react';
import type { SeriesPoint } from '@/lib/clinic-data';

function useMeasure(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(600);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver((es) => {
      for (const e of es) setW(e.contentRect.width);
    });
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

type Pt = [number, number];

// smooth path (catmull-rom -> bezier)
function smooth(pts: Pt[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0]![0]},${pts[0]![1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export function dateLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.getDate() + '/' + (d.getMonth() + 1);
}

interface LineChartProps {
  data: SeriesPoint[];
  color?: string;
  height?: number;
  area?: boolean;
  unit?: string;
  fmtV?: (v: number) => string;
  goal?: number;
  yPad?: number;
  showDots?: boolean;
}

export function LineChart({
  data,
  color = 'var(--accent)',
  height = 150,
  area = true,
  unit = '',
  fmtV,
  goal,
  yPad = 0.18,
  showDots = false,
}: LineChartProps) {
  const [ref, w] = useMeasure();
  const [hov, setHov] = useState<{ i: number; px: number; py: number } | null>(null);
  const padL = 6,
    padR = 6,
    padT = 12,
    padB = 20;
  const W = Math.max(w, 60),
    H = height;
  const vals = data.map((d) => d.value);
  let min = Math.min(...vals),
    max = Math.max(...vals);
  if (goal != null) {
    min = Math.min(min, goal);
    max = Math.max(max, goal);
  }
  const range = max - min || 1;
  min -= range * yPad;
  max += range * yPad;
  const x = (i: number) => padL + (i / (data.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const pts: Pt[] = data.map((d, i) => [x(i), y(d.value)]);
  const line = smooth(pts);
  const last = pts[pts.length - 1]!;
  const areaD = area ? `${line} L${last[0]},${H - padB} L${pts[0]![0]},${H - padB} Z` : '';
  const gid = 'g' + Math.abs(color.length * 31 + data.length) + Math.round(min);

  function move(e: React.MouseEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let i = Math.round(((px - padL) / (W - padL - padR)) * (data.length - 1));
    i = Math.max(0, Math.min(data.length - 1, i));
    setHov({ i, px: x(i), py: y(data[i]!.value) });
  }
  const fv = fmtV || ((v: number) => v.toLocaleString('pt-BR') + unit);

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        onMouseMove={move}
        onMouseLeave={() => setHov(null)}
        style={{ display: 'block', cursor: 'crosshair' }}
      >
        <defs>
          <linearGradient id={gid} x1={0} y1={0} x2={0} y2={1}>
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {goal != null && (
          <line x1={padL} x2={W - padR} y1={y(goal)} y2={y(goal)} stroke="var(--text-faint)" strokeWidth={1} strokeDasharray="4 4" opacity={0.6} />
        )}
        {area && <path d={areaD} fill={`url(#${gid})`} />}
        <path d={line} fill="none" stroke={color} strokeWidth={2.4} vectorEffect="non-scaling-stroke" />
        {showDots &&
          pts.map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r={2.5} fill="var(--surface)" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
          ))}
        {hov && (
          <g>
            <line x1={hov.px} x2={hov.px} y1={padT} y2={H - padB} stroke="var(--border-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <circle cx={hov.px} cy={hov.py} r={4.5} fill={color} stroke="var(--surface)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </g>
        )}
      </svg>
      {hov && (
        <div
          style={{
            position: 'absolute',
            left: `${(hov.px / W) * 100}%`,
            top: 0,
            transform: 'translate(-50%, -4px)',
            pointerEvents: 'none',
            background: 'var(--text)',
            color: 'var(--bg)',
            padding: '5px 9px',
            borderRadius: 8,
            fontSize: 11.5,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-pop)',
          }}
        >
          <div style={{ opacity: 0.7, fontWeight: 600, fontSize: 10 }}>{dateLabel(data[hov.i]!.date)}</div>
          {fv(data[hov.i]!.value)}
        </div>
      )}
    </div>
  );
}

interface BarChartProps {
  data: SeriesPoint[];
  color?: string;
  height?: number;
  unit?: string;
  goal?: number;
  fmtV?: (v: number) => string;
}

export function BarChart({ data, color = 'var(--accent)', height = 150, unit = '', goal, fmtV }: BarChartProps) {
  const [ref, w] = useMeasure();
  const [hov, setHov] = useState<number | null>(null);
  const padT = 12,
    padB = 22,
    gap = 0.34;
  const W = Math.max(w, 60),
    H = height;
  const vals = data.map((d) => d.value);
  const max = Math.max(...vals, goal || 0) * 1.15 || 1;
  const bw = W / data.length;
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const fv = fmtV || ((v: number) => v.toLocaleString('pt-BR') + unit);
  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }} onMouseLeave={() => setHov(null)}>
        {goal != null && <line x1={0} x2={W} y1={y(goal)} y2={y(goal)} stroke="var(--text-faint)" strokeWidth={1} strokeDasharray="4 4" opacity={0.55} />}
        {data.map((d, i) => {
          const bx = i * bw + (bw * gap) / 2,
            bWidth = bw * (1 - gap),
            by = y(d.value),
            bh = H - padB - by;
          const isWk = d.day === 0 || d.day === 6;
          return (
            <rect
              key={i}
              x={bx}
              y={by}
              width={bWidth}
              height={Math.max(1, bh)}
              rx={3}
              fill={color}
              opacity={hov == null ? (isWk ? 0.5 : 0.92) : hov === i ? 1 : 0.35}
              onMouseEnter={() => setHov(i)}
              style={{ transition: 'opacity .12s' }}
            />
          );
        })}
      </svg>
      {hov != null && (
        <div
          style={{
            position: 'absolute',
            left: `${((hov * bw + bw / 2) / W) * 100}%`,
            top: y(data[hov]!.value),
            transform: 'translate(-50%, -110%)',
            pointerEvents: 'none',
            background: 'var(--text)',
            color: 'var(--bg)',
            padding: '5px 9px',
            borderRadius: 8,
            fontSize: 11.5,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-pop)',
          }}
        >
          <div style={{ opacity: 0.7, fontWeight: 600, fontSize: 10 }}>{dateLabel(data[hov]!.date)}</div>
          {fv(data[hov]!.value)}
        </div>
      )}
    </div>
  );
}

interface SparklineProps {
  data: SeriesPoint[];
  color?: string;
  width?: number;
  height?: number;
  area?: boolean;
}

export function Sparkline({ data, color = 'var(--accent)', width = 96, height = 30, area = true }: SparklineProps) {
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals),
    max = Math.max(...vals),
    range = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * width;
  const y = (v: number) => 3 + (1 - (v - min) / range) * (height - 6);
  const pts: Pt[] = data.map((d, i) => [x(i), y(d.value)]);
  const line = smooth(pts);
  const gid = 'sp' + Math.round(min) + data.length + width;
  const last = pts[pts.length - 1]!;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1={0} y1={0} x2={0} y2={1}>
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {area && <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${gid})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.6} fill={color} />
    </svg>
  );
}

interface RingProps {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  label?: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
}

export function Ring({
  value,
  max = 100,
  size = 92,
  stroke = 9,
  color = 'var(--accent)',
  track = 'var(--surface-3)',
  label,
  sub,
  children,
}: RingProps) {
  const r = (size - stroke) / 2,
    c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        {children || (
          <div>
            <div style={{ fontSize: size * 0.27, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>{label}</div>
            {sub && <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 600, marginTop: 2 }}>{sub}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

interface DonutSeg {
  value: number;
  color: string;
}

export function Donut({ segments, size = 130, stroke = 18 }: { segments: DonutSeg[]; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2,
    c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let off = 0;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
      {segments.map((s, i) => {
        const frac = s.value / total,
          len = frac * c;
        const el = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-off}
            style={{ transition: 'stroke-dasharray .8s' }}
          />
        );
        off += len;
        return el;
      })}
    </svg>
  );
}

export function CompareBar({ value, goal, color = 'var(--accent)', height = 9 }: { value: number; goal: number; color?: string; height?: number }) {
  const pct = Math.min(1, value / goal) * 100;
  const over = value >= goal;
  return (
    <div className="progress-track" style={{ height }}>
      <div className="progress-fill" style={{ width: pct + '%', background: over ? 'var(--good)' : color }} />
    </div>
  );
}
