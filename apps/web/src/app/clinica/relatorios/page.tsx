'use client';
/* IC Clínica — Relatórios (gerador IA) */
import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/components/icons';
import { Ring, LineChart } from '@/components/charts';
import { Avatar, EmptyState, adhColor } from '@/components/ui';
import { DEVICES, type Patient } from '@/lib/clinic-data';
import { loadClinicPatients } from '@/lib/patient-source';
import { apiFetch } from '@/lib/api';

function ReportsInner() {
  const searchParams = useSearchParams();
  const paramId = searchParams.get('id');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [pid, setPid] = useState<string | null>(null);
  const [period, setPeriod] = useState(14);
  const [state, setState] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function copyReport() {
    if (!aiReport) return;
    navigator.clipboard.writeText(aiReport).catch(() => {});
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
      setLoadingPatients(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setState('idle');
    setAiReport(null);
    setAiError(null);
  }, [pid, period]);

  const p = patients.find((x) => x.id === pid);

  async function generate() {
    if (!p || !pid) return;
    setState('loading');
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
      setAiError('Não foi possível gerar o relatório agora. Verifique a conexão com a IA e tente novamente.');
    }
    setState('ready');
  }

  if (!loadingPatients && patients.length === 0) {
    return (
      <div className="page page-wide">
        <h2 className="page-title" style={{ marginBottom: 18 }}>Relatórios</h2>
        <div className="card">
          <EmptyState
            icon="sparkle"
            title="Nenhum paciente para relatar"
            desc="Cadastre pacientes para gerar relatórios clínicos com IA a partir dos dados de wearable."
          />
        </div>
      </div>
    );
  }

  const periodLabel = period === 7 ? 'Últimos 7 dias' : period === 14 ? 'Últimas 2 semanas' : 'Último mês';

  return (
    <div className="page page-wide">
      <div className="between" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title">Relatórios</h2>
          <div className="muted" style={{ marginTop: 2 }}>Resumo clínico gerado por IA a partir dos dados reais de wearable</div>
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
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{p.hasData ? DEVICES[p.device].name : 'Wearable não conectado'}</div>
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
          <button className="btn primary" style={{ width: '100%' }} onClick={generate} disabled={state === 'loading' || !p}>
            {state === 'loading' ? (
              <>
                <span className="spin" style={{ width: 15, height: 15, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} />
                Gerando…
              </>
            ) : (
              <>
                <Icon n="sparkle" size={16} />
                {aiReport ? 'Regenerar' : 'Gerar relatório'}
              </>
            )}
          </button>
          {aiReport && (
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              <button className="btn ghost" onClick={copyReport}>
                <Icon n={copied ? 'check' : 'copy'} size={15} />
                {copied ? 'Copiado!' : 'Copiar texto'}
              </button>
              <button className="btn ghost" onClick={exportPdf}>
                <Icon n="download" size={15} />
                Exportar PDF
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
        ) : aiError ? (
          <div className="card">
            <EmptyState
              icon="warn"
              title="Falha ao gerar o relatório"
              desc={aiError}
              action={
                <button className="btn primary" style={{ marginTop: 12 }} onClick={generate}>
                  <Icon n="sparkle" size={16} />
                  Tentar novamente
                </button>
              }
            />
          </div>
        ) : (
          aiReport && p && (
            <div className="card card-pad fade-in report-print" style={{ maxWidth: 760 }}>
              <div className="between" style={{ paddingBottom: 16, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
                <div>
                  <div className="row gap8" style={{ color: 'var(--accent)', marginBottom: 4 }}>
                    <Icon n="sparkle" size={15} />
                    <span className="eyebrow" style={{ color: 'var(--accent)' }}>Relatório gerado por IA (Claude)</span>
                  </div>
                  <h3 style={{ fontSize: 19, fontWeight: 800 }}>{p.name}</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{periodLabel + ' · IC Clínica'}</div>
                </div>
                {p.hasData && p.adherence > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <Ring value={p.adherence} size={64} stroke={7} color={adhColor(p.adherence)}>
                      <span className="tnum" style={{ fontSize: 17, fontWeight: 800 }}>{p.adherence + '%'}</span>
                    </Ring>
                    <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>aderência</div>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 13.5, lineHeight: 1.75, color: 'var(--text)', marginBottom: 18, whiteSpace: 'pre-wrap' }}>{aiReport}</div>
              {p.hasData && p.s.steps.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <LineChart data={p.s.steps} color="var(--c-steps)" height={110} goal={10000} unit=" passos" />
                </div>
              )}
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.5 }}>
                Gerado automaticamente a partir de dados de wearable via ROOK. Este resumo é um apoio à decisão clínica e não substitui a avaliação profissional.
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
