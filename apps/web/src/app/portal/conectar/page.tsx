'use client';
/* IC Clínica — Portal do paciente: conectar Garmin colando a URL MCP (amalgama). */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons';
import { apiFetch } from '@/lib/api';
import { getSupabase } from '@/lib/supabase';

function Logo({ size = 34 }: { size?: number }) {
  return (
    <div className="sb-logo" style={{ width: size, height: size, borderRadius: size * 0.29 }}>
      <Icon n="pulse" size={size * 0.55} strokeWidth={2.4} />
    </div>
  );
}

type ConnStatus = 'pending' | 'active' | 'reauth_required' | 'disconnected' | 'error';
type Step = 'connect' | 'done';

const GARMIN_DATA = ['Atividades / treinos', 'Frequência cardíaca', 'Sono', 'HRV'];

export default function ConnectGarminPage() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [step, setStep] = useState<Step>('connect');
  const [mcpUrl, setMcpUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conn, setConn] = useState<{ status: ConnStatus; lastSyncAt: string | null; lastError: string | null } | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user: supaUser } } = await getSupabase().auth.getUser();
      if (!supaUser) { router.push('/portal/login'); return; }
      if (supaUser.email) setUserName(supaUser.email.split('@')[0]);
      try {
        const s = await apiFetch<{ status: ConnStatus; lastSyncAt: string | null; lastError: string | null }>('/garmin/status');
        setConn(s);
        if (s.status === 'active') setStep('done');
      } catch {
        /* sem status ainda */
      }
    }
    init();
  }, [router]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setErro(null);
    setBusy(true);
    try {
      const res = await apiFetch<{ connected?: boolean }>('/garmin/connect', {
        method: 'POST',
        body: JSON.stringify({ mcpUrl: mcpUrl.trim() }),
      });
      if (res.connected) { setStep('done'); refreshStatus(); }
    } catch (err) {
      setErro(parseErr(err) ?? 'Não foi possível conectar. Confira a URL do amalgama.');
    } finally {
      setBusy(false);
    }
  }

  async function refreshStatus() {
    try { setConn(await apiFetch('/garmin/status')); } catch { /* ignore */ }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await apiFetch('/garmin/disconnect', { method: 'DELETE' });
      setConn({ status: 'disconnected', lastSyncAt: null, lastError: null });
      setStep('connect');
      setMcpUrl('');
    } catch { /* ignore */ } finally { setBusy(false); }
  }

  const steps: [string, boolean][] = [
    ['Login IC', true],
    ['Conta Garmin', step === 'done'],
    ['Pronto', step === 'done'],
  ];

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg)' }}>
      <div className="between" style={{ padding: '16px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div className="row gap10">
          <Logo size={32} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>IC Clínica</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Portal do paciente</div>
          </div>
        </div>
        <div className="row gap10">
          {conn?.status === 'active' && (
            <span className="badge good"><span className="bdot" />Garmin conectado</span>
          )}
          <div className="row gap8" style={{ paddingLeft: 6 }}>
            <div className="avatar" style={{ width: 32, height: 32, background: '#3a6ea5', fontSize: 12 }}>
              {userName ? userName.slice(0, 2).toUpperCase() : 'U'}
            </div>
            <button className="icon-btn" title="Sair" onClick={async () => { await getSupabase().auth.signOut(); router.push('/portal/login'); }}>
              <Icon n="logout" size={17} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div className="eyebrow" style={{ color: 'var(--accent)' }}>
            {userName ? `Bem-vindo, ${userName} 👋` : 'Bem-vindo 👋'}
          </div>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', textAlign: 'center' }}>Conecte seu Garmin</h1>
        <p className="muted" style={{ textAlign: 'center', maxWidth: 540, margin: '8px auto 0', lineHeight: 1.6 }}>
          Cole o <strong>link de conexão do Garmin</strong> que você gerou para que sua equipe clínica acompanhe seus treinos, sono e sinais vitais.
        </p>

        <div className="row gap10" style={{ justifyContent: 'center', margin: '22px 0 28px', flexWrap: 'wrap' }}>
          {steps.map((s, i, arr) => (
            <span key={i} style={{ display: 'contents' }}>
              <div className="row gap8">
                <div style={{ width: 22, height: 22, borderRadius: 50, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, background: s[1] ? 'var(--accent)' : 'var(--surface-3)', color: s[1] ? 'var(--on-accent)' : 'var(--text-faint)' }}>
                  {s[1] ? <Icon n="check" size={13} /> : i + 1}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: s[1] ? 'var(--text)' : 'var(--text-faint)' }}>{s[0]}</span>
              </div>
              {i < arr.length - 1 && <div style={{ width: 22, height: 1.5, background: 'var(--border)' }} />}
            </span>
          ))}
        </div>

        {/* Passo CONNECT */}
        {step === 'connect' && (
          <form onSubmit={submit} className="card" style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
            <div className="row gap10" style={{ marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-2)', display: 'grid', placeItems: 'center' }}>
                <Icon n="activity" size={20} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Link de conexão do Garmin</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Cole o link que você gerou no seu acesso</div>
              </div>
            </div>
            {conn?.status === 'error' && conn.lastError && (
              <p style={{ fontSize: 12, color: 'var(--crit)', marginBottom: 12, wordBreak: 'break-word' }}>
                Última tentativa falhou: {conn.lastError}
              </p>
            )}
            <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 6 }}>URL de conexão</label>
            <div className="search" style={{ marginBottom: 8, minWidth: 0 }}>
              <Icon n="plug" size={16} />
              <input type="url" required placeholder="https://…/api/v1/mcp/xxxxxxxx" value={mcpUrl} onChange={(e) => setMcpUrl(e.target.value)} />
            </div>
            {erro && <p style={{ color: 'var(--crit)', fontSize: 12.5, margin: '4px 0 8px' }}>{erro}</p>}
            <button type="submit" className="btn primary" style={{ width: '100%', marginTop: 8 }} disabled={busy}>
              {busy ? <span className="spin" style={{ width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} /> : <><Icon n="plug" size={16} />Conectar Garmin</>}
            </button>
            <p style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 12, lineHeight: 1.5 }}>
              Ainda não tem o link? Gere o seu acesso e cole aqui a URL que termina em <code>/mcp/…</code>.
            </p>
          </form>
        )}

        {/* Passo DONE */}
        {step === 'done' && (
          <div className="card" style={{ padding: 28, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--good-soft)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
              <Icon n="check" size={28} style={{ color: 'var(--good)' }} />
            </div>
            <h2 style={{ fontWeight: 800, fontSize: 18 }}>Garmin conectado!</h2>
            <p className="muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
              Seus dados serão sincronizados automaticamente com sua equipe clínica.
            </p>
            {conn?.lastSyncAt && (
              <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8 }}>
                Última sincronização: {new Date(conn.lastSyncAt).toLocaleString('pt-BR')}
              </p>
            )}
            <button className="btn ghost sm" style={{ marginTop: 16 }} onClick={disconnect} disabled={busy}>
              <Icon n="x" size={14} />Desconectar Garmin
            </button>
          </div>
        )}

        {/* Dados coletados */}
        <div className="card" style={{ padding: 20, maxWidth: 480, margin: '20px auto 0' }}>
          <div className="row gap8" style={{ marginBottom: 10 }}>
            <Icon n="activity" size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontWeight: 700, fontSize: 13 }}>O que é sincronizado</span>
          </div>
          <div className="row gap6 wrap">
            {GARMIN_DATA.map((s) => (
              <span key={s} style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--surface-2)', color: 'var(--text-muted)' }}>{s}</span>
            ))}
          </div>
        </div>

        {/* Privacidade */}
        <div className="card card-pad" style={{ maxWidth: 480, margin: '16px auto 0' }}>
          <div className="row gap8" style={{ marginBottom: 10 }}>
            <Icon n="lock" size={17} style={{ color: 'var(--accent)' }} />
            <span style={{ fontWeight: 700, fontSize: 13 }}>Privacidade & segurança</span>
          </div>
          <ul style={{ listStyle: 'none', display: 'grid', gap: 8 }}>
            {['Não guardamos sua senha do Garmin', 'O link fica criptografado no servidor', 'Você pode desconectar a qualquer momento', 'Conformidade com a LGPD'].map((t, i) => (
              <li key={i} className="row gap8" style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                <Icon n="check" size={14} style={{ color: 'var(--good)', flexShrink: 0 }} />{t}
              </li>
            ))}
          </ul>
        </div>

        <div className="between" style={{ marginTop: 24, flexWrap: 'wrap', gap: 12, maxWidth: 480, marginInline: 'auto' }}>
          <button className="btn ghost" onClick={async () => { await getSupabase().auth.signOut(); router.push('/portal/login'); }}>
            <Icon n="logout" size={15} />Sair
          </button>
          <button className="btn primary" onClick={() => router.push('/clinica')}>
            {step === 'done' ? 'Concluir e ver meu painel' : 'Pular por agora'}
            <Icon n="arrowRight" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function parseErr(err: unknown): string | null {
  if (!(err instanceof Error)) return null;
  const m = err.message.match(/\{.*\}/);
  if (m) {
    try {
      const body = JSON.parse(m[0]) as { message?: string | string[] };
      if (Array.isArray(body.message)) return body.message[0] ?? null;
      if (body.message) return body.message;
    } catch { /* ignore */ }
  }
  return null;
}
