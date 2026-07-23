'use client';
/* IC Clínica — Relatórios (gerador IA) */
import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/components/icons';
import { Ring, LineChart } from '@/components/charts';
import { Avatar, EmptyState, adhColor } from '@/components/ui';
import { DEVICES, fmt, type Patient } from '@/lib/clinic-data';
import { loadClinicPatients } from '@/lib/patient-source';
import { apiFetch } from '@/lib/api';

interface Report {
  summary: string;
  good: string[];
  warn: string[];
  suggestions: string[];
}

function buildReport(p: Patient, period: number): Report {
  const first = p.name.split(' ')[0];
  const good: string[] = [];
  const warn: string[] = [];
  if (p.steps >= 8000) good.push('Média de ' + fmt(p.steps) + ' passos/dia, acima do limiar de proteção cardiovascular.');
  else warn.push('Passos abaixo da meta (' + fmt(p.steps) + ' vs. 10.000/dia).');
  if (p.workouts >= 4) good.push(p.workouts + ' treinos na semana — excelente consistência.');
  else if (p.workouts === 0) warn.push('Nenhum treino registrado no período.');
  else warn.push('Apenas ' + p.workouts + ' treino(s) — abaixo da meta de 5/semana.');
  if (p.sleep >= 7) good.push('Sono médio de ' + p.sleep + 'h, dentro da faixa recomendada.');
  else warn.push('Sono médio de ' + p.sleep + 'h, abaixo da meta de 7.5h.');
  if (p.hrv >= 55) good.push('HRV de ' + p.hrv + 'ms indica boa recuperação autonômica.');
  else warn.push('HRV de ' + p.hrv + 'ms sugere recuperação comprometida.');
  if (p.syncHours > 48) warn.push('Sincronização do wearable interrompida há ' + Math.round(p.syncHours / 24) + ' dias.');

  return {
    summary:
      `Durante os últimos ${period} dias, ${first} apresentou aderência de ${p.adherence}% às metas prescritas. ` +
      (p.perf === 'high'
        ? 'O padrão geral é positivo e consistente, com boa resposta ao plano atual.'
        : p.perf === 'mid'
        ? 'O comportamento é irregular, com bom desempenho em dias úteis e queda nos finais de semana.'
        : 'Há sinais de baixa adesão que merecem atenção e possível revisão das metas e do vínculo terapêutico.'),
    good,
    warn,
    suggestions: [
      p.perf === 'high' ? 'Considerar progressão de metas (passos/treinos) em ~10–15%.' : 'Revisar metas para um patamar inicial mais alcançável.',
      p.sleep < 7 ? 'Abordar higiene do sono e horário regular de deitar.' : 'Manter rotina de sono atual.',
      p.workouts < 4 ? 'Propor 1 sessão extra de atividade leve guiada.' : 'Validar percepção de esforço e dor.',
      'Reforço positivo sobre evolução; reforçar consentimento de dados.',
    ],
  };
}

function Section({ icon, color, title, items }: { icon: string; color: string; title: string; items: string[] }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="row gap8" style={{ marginBottom: 10 }}>
        <div style={{ width: 24, height: 24, borderRadius: 7, background: 'color-mix(in oklch,' + color + ' 16%, transparent)', color, display: 'grid', placeItems: 'center' }}>
          <Icon n={icon} size={13} />
        </div>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{title}</span>
      </div>
      <ul style={{ listStyle: 'none', display: 'grid', gap: 8 }}>
        {items.map((it, i) => (
          <li key={i} className="row gap10" style={{ alignItems: 'flex-start', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            <span style={{ width: 5, height: 5, borderRadius: 50, background: color, marginTop: 7, flexShrink: 0 }} />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReportsInner() {
  const searchParams = useSearchParams();
  const paramId = searchParams.get('id');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [pid, setPid] = useState<string | null>(null);
  const [period, setPeriod] = useState(14);
  const [state, setState] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  function getReportText(): string {
    if (!p || !rep) return '';
    const lines = [
      `Relatório Clínico — ${p.name}`,
      `Últimos ${period} dias · IC Clínica`,
      '',
      rep.summary,
      '',
      'PONTOS POSITIVOS',
      ...rep.good.map((x) => `• ${x}`),
      '',
      'PONTOS DE ATENÇÃO',
      ...rep.warn.map((x) => `• ${x}`),
      '',
      'SUGESTÕES PARA A CONSULTA',
      ...rep.suggestions.map((x) => `• ${x}`),
    ];
    return aiReport ?? lines.join('\n');
  }

  function copyReport() {
    navigator.clipboard.writeText(getReportText()).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function exportPdf() {
    window.print();
  }

  useEffect(() => {
    loadClinicPatients().then((r) => {
      setPatients(r.patients);
      setPid(paramId && r.patients.some((p) => p.id === paramId) ? paramId : r.patients[0]?.id ?? null);
      if (paramId) {
        setState('loading');
        setTimeout(() => setState('ready'), 1400);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setState('idle');
  }, [pid, period]);

  const p = patients.find((x) => x.id === pid);

  async function generate() {
    if (!p || !pid) return;
    setState('loading');
    setSent(false);
    setAiError(null);
    setAiReport(null);

    try {
      const periodoLabel = period === 7 ? 'Últimos 7 dias' : period === 14 ? 'Últimas 2 semanas' : 'Último mês';
      const res = await apiFetch<{ report: string }>('/ai/report', {
        method: 'POST',
        body: JSON.stringify({ patientId: pid, periodo: periodoLabel }),
      });
      setAiReport(res.report);
    } catch {
      // fallback para rascunho local se a IA não estiver disponível
      setAiReport(null);
      setAiError('IA indisponível no momento — exibindo rascunho gerado localmente.');
    }
    setState('ready');
  }

  const rep = state === 'ready' && p ? buildReport(p, period) : null;

  return (
    <div className="page page-wide">
      <div className="between" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title">Relatórios</h2>
          <div className="muted" style={{ marginTop: 2 }}>Resumo clínico automático gerado por IA a partir dos dados de wearable</div>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: '300px 1fr', alignItems: 'start' }}>
        <div className="card card-pad" style={{ position: 'sticky', top: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Paciente</div>
          <select
            value={pid ?? ''}
            onChange={(e) => setPid(e.target.value)}
            style={{ width: '100%', padding: '10px 11px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, fontWeight: 600 }}
          >
            {patients.map((pp) => (
              <option key={pp.id} value={pp.id}>{pp.name}</option>
            ))}
          </select>
          {p && (
            <div className="row gap10" style={{ margin: '14px 0', padding: 11, background: 'var(--surface-2)', borderRadius: 10 }}>
              <Avatar p={p} size={38} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{p.age + ' anos · ' + DEVICES[p.device].name}</div>
              </div>
            </div>
          )}
          <div className="eyebrow" style={{ marginBottom: 8 }}>Período</div>
          <div className="seg" style={{ width: '100%', marginBottom: 16 }}>
            {[7, 14, 30].map((d) => (
              <button key={d} className={period === d ? 'active' : ''} style={{ flex: 1 }} onClick={() => setPeriod(d)}>
                {d + ' dias'}
              </button>
            ))}
          </div>
          <button className="btn primary" style={{ width: '100%' }} onClick={generate} disabled={state === 'loading'}>
            {state === 'loading' ? (
              <>
                <span className="spin" style={{ width: 15, height: 15, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} />
                Gerando…
              </>
            ) : (
              <>
                <Icon n="sparkle" size={16} />
                {state === 'ready' ? 'Regenerar' : 'Gerar relatório'}
              </>
            )}
          </button>
          {state === 'ready' && (
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              <button className="btn ghost" onClick={copyReport}>
                <Icon n={copied ? 'check' : 'copy'} size={15} />
                {copied ? 'Copiado!' : 'Copiar texto'}
              </button>
              <button className="btn ghost" onClick={exportPdf}>
                <Icon n="download" size={15} />
                Exportar PDF
              </button>
              <button className="btn soft" onClick={() => setSent(true)}>
                <Icon n={sent ? 'check' : 'file'} size={15} />
                {sent ? 'Enviado ao prontuário' : 'Enviar ao prontuário'}
              </button>
            </div>
          )}
        </div>

        {state === 'idle' || !p ? (
          <div className="card">
            <EmptyState
              icon="sparkle"
              title="Pronto para gerar"
              desc='Selecione paciente e período e clique em "Gerar relatório" para que a IA resuma os dados de wearable em insights clínicos acionáveis.'
              action={
                p && (
                  <button className="btn primary" style={{ marginTop: 12 }} onClick={generate}>
                    <Icon n="sparkle" size={16} />
                    Gerar agora
                  </button>
                )
              }
            />
          </div>
        ) : state === 'loading' ? (
          <div className="card card-pad">
            <div className="row gap10" style={{ marginBottom: 18, color: 'var(--accent)' }}>
              <span className="spin" style={{ width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} />
              <span style={{ fontWeight: 600, fontSize: 13 }}>{'IA analisando ' + period + ' dias de dados…'}</span>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {[80, 95, 70, 88, 60].map((w, i) => (
                <div key={i} className="skel" style={{ height: 12, width: w + '%' }} />
              ))}
            </div>
            <div className="skel" style={{ height: 120, marginTop: 18 }} />
          </div>
        ) : (
          rep && (
            <div className="card card-pad fade-in report-print" style={{ maxWidth: 760 }}>
              <div className="between" style={{ paddingBottom: 16, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
                <div>
                  <div className="row gap8" style={{ color: aiReport ? 'var(--accent)' : 'var(--warn)', marginBottom: 4 }}>
                    <Icon n="sparkle" size={15} />
                    <span className="eyebrow" style={{ color: aiReport ? 'var(--accent)' : 'var(--warn)' }}>
                      {aiReport ? 'Relatório gerado por IA (Claude)' : 'Rascunho local · IA indisponível'}
                    </span>
                  </div>
                  <h3 style={{ fontSize: 19, fontWeight: 800 }}>{p.name}</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{'Últimos ' + period + ' dias · 29 mai – 05 jun 2026 · IC Clínica'}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Ring value={p.adherence} size={64} stroke={7} color={adhColor(p.adherence)}>
                    <span className="tnum" style={{ fontSize: 17, fontWeight: 800 }}>{p.adherence + '%'}</span>
                  </Ring>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>aderência</div>
                </div>
              </div>
              {aiError && (
                <div className="row gap8" style={{ marginBottom: 16, padding: '9px 11px', background: 'var(--warn-soft)', color: 'var(--warn)', borderRadius: 9, fontSize: 12, fontWeight: 600 }}>
                  <Icon n="warn" size={14} />
                  {aiError}
                </div>
              )}
              {aiReport ? (
                <div style={{ fontSize: 13.5, lineHeight: 1.75, color: 'var(--text)', marginBottom: 18, whiteSpace: 'pre-wrap' }}>{aiReport}</div>
              ) : (
                <>
                  <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--text)', marginBottom: 18 }}>{rep.summary}</p>
                  <Section icon="check" color="var(--good)" title="Pontos positivos" items={rep.good} />
                  <Section icon="warn" color="var(--warn)" title="Pontos de atenção" items={rep.warn} />
                  <Section icon="sparkle" color="var(--accent)" title="Sugestões para a consulta" items={rep.suggestions} />
                </>
              )}
              <div style={{ marginBottom: 18 }}>
                <LineChart data={p.s.steps} color="var(--c-steps)" height={110} goal={10000} unit=" passos" />
              </div>
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.5 }}>
                Gerado automaticamente a partir de dados de wearable via Garmin. Este resumo é um apoio à decisão clínica e não substitui a avaliação profissional.
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="page page-wide" />}>
      <ReportsInner />
    </Suspense>
  );
}
