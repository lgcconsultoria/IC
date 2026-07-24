'use client';
/* IC Clínica — Portal do paciente: registrar refeição (foto → IA → kcal) */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons';
import { apiFetch } from '@/lib/api';
import { getSupabase } from '@/lib/supabase';
import {
  analyzeMealPhoto,
  addFoodLog,
  loadFoodLogs,
  readableApiError,
  type MealEstimate,
  type FoodLogsResult,
} from '@/lib/nutrition-source';

const REFEICOES = ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia'];

function Logo({ size = 34 }: { size?: number }) {
  return (
    <div className="sb-logo" style={{ width: size, height: size, borderRadius: size * 0.29 }}>
      <Icon n="pulse" size={size * 0.55} strokeWidth={2.4} />
    </div>
  );
}

export default function RegistrarRefeicaoPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [refeicao, setRefeicao] = useState('Almoço');
  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [estimate, setEstimate] = useState<MealEstimate | null>(null);
  const [descricao, setDescricao] = useState('');
  const [kcal, setKcal] = useState('');
  const [fonte, setFonte] = useState<'manual' | 'ia'>('manual');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [diary, setDiary] = useState<FoodLogsResult | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await getSupabase().auth.getUser();
      if (!user) { router.push('/portal/login'); return; }
      try {
        const me = await apiFetch<{ id: string }>('/patients/me');
        setPatientId(me.id);
        setDiary(await loadFoodLogs(me.id, today));
      } catch {
        setErro('Não encontramos seu cadastro de paciente. Fale com a clínica.');
      }
    }
    void init();
  }, [router, today]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      const comma = dataUrl.indexOf(',');
      const meta = dataUrl.slice(5, dataUrl.indexOf(';'));
      const base64 = dataUrl.slice(comma + 1);
      setAnalyzing(true);
      setEstimate(null);
      try {
        const res = await analyzeMealPhoto(base64, meta);
        if (res && (res.kcal_total > 0 || res.itens.length > 0)) {
          setEstimate(res);
          setDescricao(res.descricao);
          setKcal(String(res.kcal_total));
          setFonte('ia');
        } else {
          setErro('A IA não identificou alimentos na foto. Tente outra foto ou preencha manualmente.');
          setFonte('manual');
        }
      } catch (err) {
        const motivo = readableApiError(err);
        setErro(
          motivo
            ? `Não foi possível analisar a foto (${motivo}). Preencha manualmente.`
            : 'Não foi possível analisar a foto. Preencha manualmente.',
        );
        setFonte('manual');
      } finally {
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function salvar() {
    if (!patientId) return;
    setSaving(true);
    setErro(null);
    const ok = await addFoodLog(patientId, {
      data: today,
      refeicao,
      descricao: descricao || undefined,
      kcalEstimada: kcal ? +kcal : undefined,
      fonte,
      iaPayload: estimate ? (estimate as unknown as Record<string, unknown>) : undefined,
    });
    setSaving(false);
    if (ok) {
      setSaved(true);
      setPreview(null);
      setEstimate(null);
      setDescricao('');
      setKcal('');
      setFonte('manual');
      if (fileRef.current) fileRef.current.value = '';
      setDiary(await loadFoodLogs(patientId, today));
      setTimeout(() => setSaved(false), 2500);
    } else {
      setErro('Falha ao registrar. Tente novamente.');
    }
  }

  const field = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 } as const;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 20 }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <div className="between" style={{ marginBottom: 18 }}>
          <div className="row gap10">
            <Logo size={38} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Registrar refeição</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Foto + estimativa de calorias por IA</div>
            </div>
          </div>
          <button className="btn ghost sm" onClick={() => router.push('/portal/painel')}>
            <Icon n="chevL" size={14} /> Voltar
          </button>
        </div>

        {diary?.kcal_meta_dia != null && (
          <div className="card card-pad" style={{ marginBottom: 14 }}>
            <div className="between">
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Hoje</span>
              <span className="tnum" style={{ fontWeight: 700 }}>
                {diary.total_kcal.toLocaleString('pt-BR')} / {diary.kcal_meta_dia.toLocaleString('pt-BR')} kcal
              </span>
            </div>
            <div className="progress-track" style={{ height: 7, marginTop: 8 }}>
              <div className="progress-fill" style={{ width: Math.min(100, (diary.total_kcal / diary.kcal_meta_dia) * 100) + '%', background: diary.total_kcal > diary.kcal_meta_dia ? 'var(--crit)' : 'var(--c-cal)' }} />
            </div>
          </div>
        )}

        <div className="card card-pad">
          <label style={{ display: 'block', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Refeição</div>
            <select value={refeicao} onChange={(e) => setRefeicao(e.target.value)} style={field}>
              {REFEICOES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>

          {/* Foto */}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: 'none' }} />
          <button
            className="btn soft"
            style={{ width: '100%', marginBottom: 12, justifyContent: 'center' }}
            onClick={() => fileRef.current?.click()}
            disabled={analyzing}
          >
            <Icon n="camera" size={16} />
            {preview ? 'Trocar foto' : 'Tirar / enviar foto'}
          </button>

          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="refeição" style={{ width: '100%', borderRadius: 12, marginBottom: 12, maxHeight: 240, objectFit: 'cover' }} />
          )}

          {analyzing && (
            <div className="row gap10" style={{ color: 'var(--accent)', marginBottom: 12 }}>
              <span className="spin" style={{ width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>IA analisando a refeição…</span>
            </div>
          )}

          {estimate && (
            <div className="fade-in" style={{ marginBottom: 12, padding: 12, background: 'var(--accent-soft)', borderRadius: 10 }}>
              <div className="row gap6" style={{ color: 'var(--accent-ink)', fontSize: 11.5, fontWeight: 700, marginBottom: 6 }}>
                <Icon n="sparkle" size={13} /> Estimativa da IA · confiança {Math.round(estimate.confianca * 100)}%
              </div>
              {estimate.itens.slice(0, 6).map((it, i) => (
                <div key={i} className="between" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>{it.alimento} <span style={{ opacity: 0.7 }}>({it.porcao})</span></span>
                  <span className="tnum">{it.kcal} kcal</span>
                </div>
              ))}
            </div>
          )}

          <label style={{ display: 'block', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Descrição</div>
            <input value={descricao} onChange={(e) => { setDescricao(e.target.value); setFonte('manual'); }} placeholder="Ex.: Arroz, feijão, frango e salada" style={field} />
          </label>

          <label style={{ display: 'block', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Calorias estimadas</div>
            <input type="number" inputMode="numeric" value={kcal} onChange={(e) => { setKcal(e.target.value); setFonte('manual'); }} placeholder="kcal" style={field} />
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
              {fonte === 'ia' ? 'Valor estimado pela IA — ajuste se necessário.' : 'Você pode preencher manualmente.'}
            </div>
          </label>

          {erro && <p style={{ color: 'var(--crit)', fontSize: 12.5, marginBottom: 10 }}>{erro}</p>}

          <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }} onClick={salvar} disabled={saving || !patientId || (!descricao && !kcal)}>
            <Icon n={saved ? 'check' : 'flame'} size={16} />
            {saving ? 'Salvando…' : saved ? 'Registrada!' : 'Registrar refeição'}
          </button>
        </div>

        {diary && diary.logs.length > 0 && (
          <div className="card card-pad" style={{ marginTop: 14 }}>
            <div className="section-title" style={{ fontSize: 14, marginBottom: 10 }}>Refeições de hoje</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {diary.logs.map((l) => (
                <div key={l.id} className="between" style={{ fontSize: 13 }}>
                  <span>{l.refeicao}{l.descricao ? ' · ' + l.descricao : ''}</span>
                  <span className="tnum" style={{ fontWeight: 700 }}>{(l.kcal_estimada ?? 0).toLocaleString('pt-BR')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
