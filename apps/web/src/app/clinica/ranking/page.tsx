'use client';
/* IC Clínica — Ranking de resultados: perda de peso + massa magra + InBody. */
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons';
import {
  loadRanking,
  type RankingResult,
  type RankingItem,
  type Publico,
  type Genero,
} from '@/lib/ranking-source';

const PERIODOS: { label: string; days: number }[] = [
  { label: '30 dias', days: 30 },
  { label: '60 dias', days: 60 },
  { label: '90 dias', days: 90 },
  { label: '120 dias', days: 120 },
  { label: 'Anual', days: 365 },
];

const MEDALHA = ['#f6c945', '#c7ccd1', '#cd8b57']; // ouro, prata, bronze

export default function RankingPage() {
  const [days, setDays] = useState<number | null>(90);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [custom, setCustom] = useState(false);
  const [publicos, setPublicos] = useState<Publico[]>(['pacientes']);
  const [genero, setGenero] = useState<'todos' | Genero>('todos');
  const [data, setData] = useState<RankingResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const generos: Genero[] = genero === 'todos' ? [] : [genero];
    loadRanking({
      days: custom ? undefined : days ?? 90,
      from: custom && from ? from : undefined,
      to: custom && to ? to : undefined,
      publicos: publicos.length ? publicos : ['pacientes'],
      generos,
    }).then((r) => {
      if (alive) { setData(r); setLoading(false); }
    });
    return () => { alive = false; };
  }, [days, from, to, custom, publicos, genero]);

  function togglePublico(p: Publico) {
    setPublicos((cur) =>
      cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p],
    );
  }

  const itens = data?.itens ?? [];
  const top3 = itens.slice(0, 3);
  const resto = itens.slice(3);
  const maxScore = useMemo(
    () => Math.max(1, ...itens.map((i) => i.score ?? 0)),
    [itens],
  );

  const chip = (active: boolean) =>
    ({
      padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 600,
      cursor: 'pointer', border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
      background: active ? 'var(--accent)' : 'var(--surface)',
      color: active ? 'var(--on-accent)' : 'var(--text-muted)',
    }) as const;

  return (
    <div className="page page-wide">
      <div style={{ marginBottom: 18 }}>
        <h2 className="page-title" style={{ fontSize: 22 }}>Ranking de resultados</h2>
        <div className="muted" style={{ fontSize: 13 }}>
          Considera perda de peso, ganho de massa magra e evolução da pontuação da bioimpedância (InBody).
        </div>
      </div>

      {/* Filtros */}
      <div className="card card-pad" style={{ marginBottom: 18, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Período</div>
          <div className="row gap8" style={{ flexWrap: 'wrap' }}>
            {PERIODOS.map((p) => (
              <button key={p.days} style={chip(!custom && days === p.days)} onClick={() => { setCustom(false); setDays(p.days); }}>
                {p.label}
              </button>
            ))}
            <button style={chip(custom)} onClick={() => setCustom(true)}>Personalizado</button>
            {custom && (
              <span className="row gap6" style={{ flexWrap: 'wrap' }}>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="search" style={{ padding: '6px 10px' }} />
                <span style={{ color: 'var(--text-faint)' }}>até</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="search" style={{ padding: '6px 10px' }} />
              </span>
            )}
          </div>
        </div>

        <div className="row gap8" style={{ flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Público</div>
            <div className="row gap8" style={{ flexWrap: 'wrap' }}>
              <button style={chip(publicos.includes('pacientes'))} onClick={() => togglePublico('pacientes')}>Pacientes</button>
              <button style={chip(publicos.includes('funcionarios'))} onClick={() => togglePublico('funcionarios')}>Funcionários</button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Gênero</div>
            <div className="row gap8" style={{ flexWrap: 'wrap' }}>
              <button style={chip(genero === 'todos')} onClick={() => setGenero('todos')}>Todos</button>
              <button style={chip(genero === 'F')} onClick={() => setGenero('F')}>Mulheres</button>
              <button style={chip(genero === 'M')} onClick={() => setGenero('M')}>Homens</button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 60 }}>
          <span className="spin" style={{ width: 28, height: 28, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }} />
        </div>
      ) : itens.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <Icon n="activity" size={30} style={{ color: 'var(--text-faint)' }} />
          <h3 style={{ fontWeight: 800, fontSize: 16, marginTop: 10 }}>Sem resultados no período</h3>
          <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
            O ranking aparece quando houver pelo menos duas medições (peso ou bioimpedância) no período selecionado.
          </p>
        </div>
      ) : (
        <>
          {/* Pódio */}
          {top3.length >= 1 && (
            <div className="row gap12" style={{ justifyContent: 'center', alignItems: 'flex-end', marginBottom: 22, flexWrap: 'wrap' }}>
              {[1, 0, 2].map((pos) => {
                const it = top3[pos];
                if (!it) return null;
                const h = pos === 0 ? 150 : pos === 1 ? 116 : 96;
                return (
                  <div key={it.patient_id} style={{ width: 150, textAlign: 'center' }}>
                    <Avatar nome={it.nome} ring={MEDALHA[pos]} big={pos === 0} />
                    <div style={{ fontWeight: 800, fontSize: 13.5, marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.nome}</div>
                    <div className="tnum" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>{it.score?.toLocaleString('pt-BR')} pts</div>
                    <div style={{ height: h, borderRadius: '12px 12px 0 0', marginTop: 8, background: `linear-gradient(180deg, ${MEDALHA[pos]}33, ${MEDALHA[pos]}11)`, border: '1px solid var(--border)', borderBottom: 'none', display: 'grid', placeItems: 'center' }}>
                      <div style={{ fontSize: 30, fontWeight: 900, color: MEDALHA[pos] }}>{pos + 1}º</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Lista completa */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
              Classificação geral · {itens.length} {itens.length === 1 ? 'pessoa' : 'pessoas'}
            </div>
            <div>
              {itens.map((it, i) => (
                <Row key={it.patient_id} it={it} pos={i + 1} pct={((it.score ?? 0) / maxScore) * 100} />
              ))}
            </div>
          </div>

          <p className="muted" style={{ fontSize: 11.5, marginTop: 12 }}>
            Score = perda de peso (kg) × {data?.pesos.perdaPeso} + ganho de massa magra (kg) × {data?.pesos.ganhoMassaMagra} + Δ pontuação InBody × {data?.pesos.pontuacaoInbody}.
          </p>
        </>
      )}
    </div>
  );
}

function Row({ it, pos, pct }: { it: RankingItem; pos: number; pct: number }) {
  return (
    <div className="between" style={{ padding: '12px 18px', borderTop: pos > 1 ? '1px solid var(--border)' : 'none', gap: 14, flexWrap: 'wrap' }}>
      <div className="row gap12" style={{ minWidth: 200, flex: 1 }}>
        <div style={{ width: 26, textAlign: 'center', fontWeight: 800, color: pos <= 3 ? MEDALHA[pos - 1] : 'var(--text-faint)' }}>{pos}º</div>
        <Avatar nome={it.nome} ring={pos <= 3 ? MEDALHA[pos - 1] : 'var(--border)'} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>
            {it.nome}
            {it.eh_funcionario && <span className="badge accent" style={{ marginLeft: 6, fontSize: 9.5 }}>Equipe</span>}
          </div>
          <div className="row gap10" style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, flexWrap: 'wrap' }}>
            {it.perda_peso_kg != null && <Metric icon="flame" v={pesoStr(it.perda_peso_kg)} pos={it.perda_peso_kg > 0} label="peso" />}
            {it.ganho_massa_magra_kg != null && <Metric icon="activity" v={magraStr(it.ganho_massa_magra_kg)} pos={it.ganho_massa_magra_kg > 0} label="magra" />}
            {it.delta_pontuacao_inbody != null && <Metric icon="pulse" v={(it.delta_pontuacao_inbody > 0 ? '+' : '') + it.delta_pontuacao_inbody} pos={it.delta_pontuacao_inbody > 0} label="InBody" />}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 160, maxWidth: 320 }}>
        <div className="between" style={{ marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Score</span>
          <span className="tnum" style={{ fontWeight: 800, fontSize: 13 }}>{it.score?.toLocaleString('pt-BR')}</span>
        </div>
        <div className="progress-track" style={{ height: 8 }}>
          <div className="progress-fill" style={{ width: Math.max(3, pct) + '%', background: 'var(--accent)' }} />
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, v, pos, label }: { icon: string; v: string; pos: boolean; label: string }) {
  return (
    <span className="row gap6" title={label}>
      <Icon n={icon} size={12} style={{ color: pos ? 'var(--good)' : 'var(--text-faint)' }} />
      <span style={{ color: pos ? 'var(--good)' : 'var(--text-muted)', fontWeight: 600 }}>{v}</span>
      <span style={{ color: 'var(--text-faint)' }}>{label}</span>
    </span>
  );
}

function Avatar({ nome, ring, big }: { nome: string; ring: string; big?: boolean }) {
  const size = big ? 64 : 34;
  const initials = nome.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', margin: big ? '0 auto' : undefined, background: 'var(--surface-2)', color: 'var(--text)', fontWeight: 800, fontSize: big ? 22 : 13, border: `2.5px solid ${ring}` }}>
      {initials || '?'}
    </div>
  );
}

// perda de peso: valor >0 = perdeu → mostra "−X kg"
function pesoStr(kg: number): string {
  const s = kg > 0 ? '−' : kg < 0 ? '+' : '';
  return `${s}${Math.abs(kg).toLocaleString('pt-BR')} kg`;
}
// ganho de massa magra: valor >0 = ganhou → mostra "+X kg"
function magraStr(kg: number): string {
  const s = kg > 0 ? '+' : kg < 0 ? '−' : '';
  return `${s}${Math.abs(kg).toLocaleString('pt-BR')} kg`;
}
