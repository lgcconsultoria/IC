'use client';
/* IC Clínica — Metas do paciente */
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Icon } from '@/components/icons';
import { Ring } from '@/components/charts';
import { Avatar, adhColor } from '@/components/ui';
import { type Patient } from '@/lib/clinic-data';
import { loadPatient } from '@/lib/patient-source';
import { apiFetch } from '@/lib/api';

interface GoalDef {
  key: string;
  icon: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  color: string;
  cur: (p: Patient) => number;
  base: (p: Patient) => number;
  invert?: boolean;
}

const DEFS: GoalDef[] = [
  { key: 'steps', icon: 'foot', label: 'Passos / dia', unit: '', min: 4000, max: 16000, step: 500, color: 'var(--c-steps)', cur: (p) => p.steps, base: (p) => p.goalSteps },
  { key: 'cal', icon: 'flame', label: 'Calorias ativas / semana', unit: 'kcal', min: 2000, max: 7000, step: 250, color: 'var(--c-cal)', cur: (p) => p.calories, base: (p) => p.goalCal },
  { key: 'workouts', icon: 'dumbbell', label: 'Treinos / semana', unit: '', min: 0, max: 7, step: 1, color: 'var(--accent)', cur: (p) => p.workouts, base: (p) => p.goalWorkouts },
  { key: 'active', icon: 'clock', label: 'Minutos ativos / dia', unit: 'min', min: 10, max: 90, step: 5, color: 'var(--info)', cur: (p) => Math.round(p.steps / 350), base: (p) => p.goalActiveMin },
  { key: 'sleep', icon: 'moon', label: 'Sono / noite', unit: 'h', min: 5, max: 10, step: 0.5, color: 'var(--c-sleep)', cur: (p) => p.sleep, base: (p) => p.goalSleep },
  { key: 'weight', icon: 'scale', label: 'Peso alvo', unit: 'kg', min: 50, max: 110, step: 0.5, color: 'var(--c-weight)', cur: (p) => p.weight, base: (p) => p.weight - 4, invert: true },
];

function GoalEditor({
  def, p, value, onChange,
}: { def: GoalDef; p: Patient; value: number; onChange: (key: string, v: number) => void }) {
  const cur = def.cur(p);
  const pct = def.invert
    ? Math.min(100, Math.round(cur <= value ? 100 : (value / cur) * 100))
    : Math.min(100, Math.round((cur / value) * 100));
  return (
    <div className="card card-pad">
      <div className="between" style={{ marginBottom: 14 }}>
        <div className="row gap10">
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'color-mix(in oklch,' + def.color + ' 14%, transparent)', color: def.color, display: 'grid', placeItems: 'center' }}>
            <Icon n={def.icon} size={17} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{def.label}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{'Atual: ' + cur.toLocaleString('pt-BR') + ' ' + def.unit}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="tnum" style={{ fontSize: 20, fontWeight: 800, color: def.color }}>{value.toLocaleString('pt-BR')}</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>{'meta ' + def.unit}</div>
        </div>
      </div>
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        onChange={(e) => onChange(def.key, +e.target.value)}
        style={{ width: '100%', accentColor: def.color, height: 6 }}
      />
      <div className="between" style={{ marginTop: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Progresso</span>
        <span className="tnum" style={{ fontSize: 12, fontWeight: 700, color: pct >= 100 ? 'var(--good)' : 'var(--text-muted)' }}>{pct + '%'}</span>
      </div>
      <div className="progress-track" style={{ height: 7, marginTop: 5 }}>
        <div className="progress-fill" style={{ width: pct + '%', background: pct >= 100 ? 'var(--good)' : def.color }} />
      </div>
    </div>
  );
}

const HISTORY = [
  { date: '28 mai 2026', change: 'Passos: 8.000 → 10.000', by: 'Dra. Marina', icon: 'foot', note: 'Progressão após 3 semanas consistentes' },
  { date: '14 mai 2026', change: 'Sono: 7.0h → 7.5h', by: 'Dr. Paulo (nutrólogo)', icon: 'moon', note: 'Foco em higiene do sono' },
  { date: '02 mai 2026', change: 'Treinos: 3 → 5 / semana', by: 'Lucas (ed. físico)', icon: 'dumbbell', note: 'Início do plano de hipertrofia' },
  { date: '20 abr 2026', change: 'Metas iniciais definidas', by: 'Dra. Marina', icon: 'target', note: 'Onboarding do paciente' },
];

export default function GoalsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [p, setP] = useState<Patient | null>(null);
  const [goalValues, setGoalValues] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadPatient(params.id).then((res) => {
      if (!alive) return;
      setP(res);
      if (res) {
        const init: Record<string, number> = {};
        DEFS.forEach((d) => { init[d.key] = d.base(res); });
        setGoalValues(init);
      }
    });
    return () => { alive = false; };
  }, [params.id]);

  function handleGoalChange(key: string, value: number) {
    setSaved(false);
    setSaveError(null);
    setGoalValues((prev) => ({ ...prev, [key]: value }));
  }

  async function saveGoals() {
    if (!p) return;
    setSaving(true);
    setSaveError(null);
    try {
      await apiFetch(`/patients/${p.id}/goals`, {
        method: 'PATCH',
        body: JSON.stringify(goalValues),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao salvar metas');
    } finally {
      setSaving(false);
    }
  }

  if (!p) {
    return (
      <div className="page page-wide">
        <div className="card card-pad" style={{ height: 100 }}>
          <div className="skel" style={{ width: 220, height: 18 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="page page-wide">
      <button className="btn ghost sm" style={{ marginBottom: 16 }} onClick={() => router.push(`/clinica/pacientes/${p.id}`)}>
        <Icon n="chevL" size={15} />
        Voltar ao perfil
      </button>
      <div className="between" style={{ marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="row gap12">
          <Avatar p={p} size={46} />
          <div>
            <h2 className="page-title" style={{ fontSize: 20 }}>{'Metas de ' + p.name}</h2>
            <div className="muted">Defina e acompanhe as metas semanais prescritas</div>
          </div>
        </div>
        <div className="row gap8" style={{ alignItems: 'center' }}>
          {saveError && <span style={{ fontSize: 12, color: 'var(--crit)' }}>{saveError}</span>}
          {saved && <span style={{ fontSize: 12.5, color: 'var(--good)', display: 'flex', alignItems: 'center', gap: 5 }}><Icon n="check" size={14} />Metas salvas!</span>}
          <button className="btn ghost" onClick={() => router.push(`/clinica/pacientes/${p.id}`)}>Cancelar</button>
          <button className="btn primary" onClick={saveGoals} disabled={saving}>
            {saving
              ? <span className="spin" style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} />
              : <Icon n={saved ? 'check' : 'target'} size={16} />}
            {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar metas'}
          </button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.7fr 1fr', alignItems: 'start' }}>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {DEFS.map((d) => (
            <GoalEditor
              key={d.key}
              def={d}
              p={p}
              value={goalValues[d.key] ?? d.base(p)}
              onChange={handleGoalChange}
            />
          ))}
        </div>
        <div className="grid">
          <div className="card card-pad" style={{ textAlign: 'center' }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Score de aderência projetado</div>
            <Ring value={p.adherence} size={120} stroke={12} color={adhColor(p.adherence)}>
              <div>
                <div className="tnum" style={{ fontSize: 32, fontWeight: 800 }}>{p.adherence}</div>
                <div style={{ fontSize: 10, color: 'var(--text-faint)', fontWeight: 700 }}>/ 100</div>
              </div>
            </Ring>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14, lineHeight: 1.5 }}>Metas equilibradas aumentam a chance de adesão. Evite saltos maiores que 20% por ciclo.</p>
          </div>
          <div className="card card-pad">
            <div className="section-title" style={{ fontSize: 14.5, marginBottom: 14 }}>Histórico de metas</div>
            <div style={{ display: 'grid', gap: 14 }}>
              {HISTORY.map((h, i) => (
                <div key={i} className="row gap10" style={{ alignItems: 'flex-start' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--surface-2)', color: 'var(--text-muted)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Icon n={h.icon} size={15} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12.5 }}>{h.change}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{h.note}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 2 }}>{h.date + ' · ' + h.by}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
