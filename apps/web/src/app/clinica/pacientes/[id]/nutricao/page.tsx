'use client';
/* IC Clínica — Nutrição do paciente: cardápio + diário alimentar */
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Icon } from '@/components/icons';
import { Ring } from '@/components/charts';
import { Avatar } from '@/components/ui';
import { type Patient } from '@/lib/clinic-data';
import { loadPatient } from '@/lib/patient-source';
import {
  loadMealPlan,
  saveMealPlan,
  loadFoodLogs,
  loadMetabolism,
  saveMetabolism,
  NIVEL_ATIVIDADE_LABEL,
  type MealPlanItem,
  type FoodLogsResult,
  type Metabolism,
  type NivelAtividade,
} from '@/lib/nutrition-source';

const REFEICOES = ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia'];

function emptyItem(refeicao = 'Café da manhã'): MealPlanItem {
  return { refeicao, descricao: '', kcal_estimada: null };
}

export default function NutricaoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [p, setP] = useState<Patient | null>(null);
  const [titulo, setTitulo] = useState('Plano alimentar');
  const [metaKcal, setMetaKcal] = useState<string>('');
  const [itens, setItens] = useState<MealPlanItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle');
  const [diary, setDiary] = useState<FoodLogsResult | null>(null);
  const [met, setMet] = useState<Metabolism | null>(null);
  const [peso, setPeso] = useState('');
  const [nivel, setNivel] = useState<NivelAtividade>('moderado');
  const [tmbMedido, setTmbMedido] = useState('');
  const [savingMet, setSavingMet] = useState(false);
  const [metState, setMetState] = useState<'idle' | 'saved' | 'error'>('idle');
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let alive = true;
    loadPatient(id).then((res) => alive && setP(res));
    loadMealPlan(id).then((plan) => {
      if (!alive || !plan) return;
      setTitulo(plan.titulo);
      setMetaKcal(plan.kcal_meta_dia != null ? String(plan.kcal_meta_dia) : '');
      if (plan.itens.length > 0) setItens(plan.itens);
    });
    loadFoodLogs(id, today).then((d) => alive && setDiary(d));
    loadMetabolism(id).then((m) => {
      if (!alive || !m) return;
      setMet(m);
      setPeso(m.peso_kg != null ? String(m.peso_kg) : '');
      setNivel(m.nivel_atividade);
      setTmbMedido(m.tmb_medido_kcal != null ? String(m.tmb_medido_kcal) : '');
    });
    return () => {
      alive = false;
    };
  }, [id, today]);

  async function handleSaveMet() {
    setSavingMet(true);
    setMetState('idle');
    const res = await saveMetabolism(id, {
      pesoKg: peso ? +peso : undefined,
      nivelAtividade: nivel,
      tmbMedidoKcal: tmbMedido ? +tmbMedido : undefined,
    });
    setSavingMet(false);
    if (res) {
      setMet(res);
      setMetState('saved');
    } else {
      setMetState('error');
    }
    setTimeout(() => setMetState('idle'), 2500);
  }

  function updateItem(i: number, patch: Partial<MealPlanItem>) {
    setItens((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItens((arr) => [...arr, emptyItem(REFEICOES[Math.min(arr.length, REFEICOES.length - 1)])]);
  }
  function removeItem(i: number) {
    setItens((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr));
  }

  const totalPlano = itens.reduce((a, it) => a + (Number(it.kcal_estimada) || 0), 0);

  async function handleSave() {
    setSaving(true);
    setSaveState('idle');
    const res = await saveMealPlan(id, {
      titulo,
      kcalMetaDia: metaKcal ? +metaKcal : undefined,
      itens: itens
        .filter((it) => it.refeicao)
        .map((it) => ({
          refeicao: it.refeicao,
          descricao: it.descricao ?? undefined,
          kcalEstimada: it.kcal_estimada != null ? Number(it.kcal_estimada) : undefined,
        })),
    });
    setSaving(false);
    setSaveState(res ? 'saved' : 'error');
    if (res) loadFoodLogs(id, today).then(setDiary);
    setTimeout(() => setSaveState('idle'), 2500);
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

  const meta = diary?.kcal_meta_dia ?? (metaKcal ? +metaKcal : null);
  const consumido = diary?.total_kcal ?? 0;
  const pct = meta ? Math.min(100, Math.round((consumido / meta) * 100)) : 0;

  const field = { width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 } as const;

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
            <h2 className="page-title" style={{ fontSize: 20 }}>{'Nutrição de ' + p.name}</h2>
            <div className="muted">Monte o cardápio e acompanhe a ingestão diária</div>
          </div>
        </div>
        <div className="row gap8">
          {saveState === 'error' && <span className="badge crit" style={{ alignSelf: 'center' }}>Falha ao salvar</span>}
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            <Icon n={saveState === 'saved' ? 'check' : 'flame'} size={16} />
            {saving ? 'Salvando…' : saveState === 'saved' ? 'Cardápio salvo!' : 'Salvar cardápio'}
          </button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.7fr 1fr', alignItems: 'start' }}>
        {/* Editor de cardápio */}
        <div className="card card-pad">
          <div className="row gap8" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
            <label style={{ flex: 2, minWidth: 160 }}>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>Título do plano</div>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} style={field} />
            </label>
            <label style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>Meta de kcal/dia</div>
              <input type="number" inputMode="numeric" value={metaKcal} onChange={(e) => setMetaKcal(e.target.value)} placeholder="2000" style={field} />
            </label>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {itens.map((it, i) => (
              <div key={i} className="row gap8" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <select value={it.refeicao} onChange={(e) => updateItem(i, { refeicao: e.target.value })} style={{ ...field, flex: 1, minWidth: 130 }}>
                  {REFEICOES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <input value={it.descricao ?? ''} onChange={(e) => updateItem(i, { descricao: e.target.value })} placeholder="Ex.: 2 ovos, pão integral, café" style={{ ...field, flex: 3, minWidth: 180 }} />
                <input type="number" inputMode="numeric" value={it.kcal_estimada ?? ''} onChange={(e) => updateItem(i, { kcal_estimada: e.target.value ? +e.target.value : null })} placeholder="kcal" style={{ ...field, width: 90 }} />
                <button className="icon-btn" title="Remover" onClick={() => removeItem(i)} style={{ color: 'var(--text-faint)', height: 38 }}>✕</button>
              </div>
            ))}
          </div>

          <div className="between" style={{ marginTop: 14 }}>
            <button className="btn ghost sm" onClick={addItem}>
              <Icon n="plus" size={15} />
              Adicionar refeição
            </button>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              Total do plano: <b className="tnum">{totalPlano.toLocaleString('pt-BR')}</b> kcal
            </div>
          </div>
        </div>

        {/* Diário do dia */}
        <div className="card card-pad">
          <div className="section-title" style={{ fontSize: 15, marginBottom: 14 }}>Ingestão de hoje</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Ring value={pct} size={120} stroke={12} color={pct > 100 ? 'var(--crit)' : 'var(--c-cal)'}>
              <div style={{ textAlign: 'center' }}>
                <div className="tnum" style={{ fontSize: 24, fontWeight: 800 }}>{consumido.toLocaleString('pt-BR')}</div>
                <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{meta ? '/ ' + meta.toLocaleString('pt-BR') + ' kcal' : 'kcal'}</div>
              </div>
            </Ring>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              {meta ? (consumido <= meta ? `Faltam ${(meta - consumido).toLocaleString('pt-BR')} kcal para a meta` : `${(consumido - meta).toLocaleString('pt-BR')} kcal acima da meta`) : 'Defina uma meta de kcal/dia'}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            {!diary || diary.logs.length === 0 ? (
              <p style={{ fontSize: 12.5, color: 'var(--text-faint)', textAlign: 'center', padding: '14px 0' }}>
                Nenhuma refeição registrada hoje. O paciente registra pelo portal (com foto e estimativa por IA).
              </p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {diary.logs.map((l) => (
                  <div key={l.id} className="between" style={{ padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 9 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{l.refeicao}{l.fonte === 'ia' && <span className="badge accent" style={{ marginLeft: 6, fontSize: 9.5 }}>IA</span>}</div>
                      {l.descricao && <div style={{ fontSize: 11, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{l.descricao}</div>}
                    </div>
                    <span className="tnum" style={{ fontSize: 12.5, fontWeight: 700 }}>{(l.kcal_estimada ?? 0).toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metabolismo: TMB (calculada) + calorimetria (medida) + TDEE + balanço */}
      <div className="card card-pad" style={{ marginTop: 16 }}>
        <div className="between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="section-title" style={{ fontSize: 15 }}>Metabolismo & gasto energético</div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              TMB calculada por Mifflin-St Jeor; a calorimetria medida (repouso) tem prioridade.
            </div>
          </div>
          <div className="row gap8">
            {metState === 'error' && <span className="badge crit" style={{ alignSelf: 'center' }}>Falha ao salvar</span>}
            <button className="btn primary" onClick={handleSaveMet} disabled={savingMet}>
              <Icon n={metState === 'saved' ? 'check' : 'flame'} size={16} />
              {savingMet ? 'Salvando…' : metState === 'saved' ? 'Salvo!' : 'Salvar metabolismo'}
            </button>
          </div>
        </div>

        <div className="row gap8" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
          <label style={{ flex: 1, minWidth: 130 }}>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>Peso atual (kg)</div>
            <input type="number" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="Ex.: 72.5" style={field} />
          </label>
          <label style={{ flex: 2, minWidth: 200 }}>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>Nível de atividade física</div>
            <select value={nivel} onChange={(e) => setNivel(e.target.value as NivelAtividade)} style={field}>
              {(Object.keys(NIVEL_ATIVIDADE_LABEL) as NivelAtividade[]).map((k) => (
                <option key={k} value={k}>{NIVEL_ATIVIDADE_LABEL[k]}</option>
              ))}
            </select>
          </label>
          <label style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>
              Gasto em repouso medido (kcal/dia)
            </div>
            <input type="number" inputMode="numeric" value={tmbMedido} onChange={(e) => setTmbMedido(e.target.value)} placeholder="Calorimetria / InBody" style={field} />
          </label>
        </div>

        {met && (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <MetTile
              label={met.tmb_fonte === 'medido' ? 'TMB (medida)' : 'TMB (calculada)'}
              value={met.tmb != null ? met.tmb.toLocaleString('pt-BR') + ' kcal' : '—'}
              hint={met.tmb_fonte === 'medido' ? 'Calorimetria da clínica' : met.tmb_calculado != null ? 'Mifflin-St Jeor' : 'Faltam dados do perfil'}
              accent={met.tmb_fonte === 'medido'}
            />
            <MetTile
              label="TDEE (gasto total)"
              value={met.tdee != null ? met.tdee.toLocaleString('pt-BR') + ' kcal' : '—'}
              hint={`TMB × ${met.fator_atividade}`}
            />
            <MetTile
              label="Consumido hoje"
              value={met.consumido_hoje.toLocaleString('pt-BR') + ' kcal'}
              hint="Diário alimentar"
            />
            <MetTile
              label="Balanço de hoje"
              value={met.saldo_hoje != null ? (met.saldo_hoje > 0 ? '+' : '') + met.saldo_hoje.toLocaleString('pt-BR') + ' kcal' : '—'}
              hint={met.balanco === 'deficit' ? 'Déficit calórico' : met.balanco === 'superavit' ? 'Superávit calórico' : met.balanco === 'neutro' ? 'Equilíbrio' : 'Sem dados suficientes'}
              tone={met.balanco === 'deficit' ? 'good' : met.balanco === 'superavit' ? 'warn' : 'neutral'}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function MetTile({ label, value, hint, accent, tone }: {
  label: string; value: string; hint?: string;
  accent?: boolean; tone?: 'good' | 'warn' | 'neutral';
}) {
  const color =
    tone === 'good' ? 'var(--good)' : tone === 'warn' ? 'var(--warn, #d97706)' : accent ? 'var(--accent)' : 'var(--text)';
  return (
    <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>{label}</div>
      <div className="tnum" style={{ fontSize: 19, fontWeight: 800, color }}>{value}</div>
      {hint && <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}
