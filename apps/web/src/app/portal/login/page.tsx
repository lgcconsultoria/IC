'use client';
/* IC Clínica — Login do paciente (autenticação real via Supabase) */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons';
import { DeviceBadge } from '@/components/ui';
import { getSupabase } from '@/lib/supabase';

export default function PatientLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setErro(null);
    setBusy(true);
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email, password: pw });
      if (error) throw error;
      router.push('/portal/painel');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha no login');
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: 'google' | 'apple') {
    setErro(null);
    try {
      const { error } = await getSupabase().auth.signInWithOAuth({
        provider,
        options: { redirectTo: typeof window !== 'undefined' ? window.location.origin + '/portal/painel' : undefined },
      });
      if (error) throw error;
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Provedor indisponível');
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%', overflow: 'auto' }}>
      <div
        className="hide-sm"
        style={{
          background: 'linear-gradient(150deg, var(--accent-strong), var(--accent) 55%, oklch(0.62 0.11 175))',
          color: 'var(--on-accent)',
          padding: 48,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div className="row gap12">
          <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center' }}>
            <Icon n="pulse" size={22} strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>IC Clínica</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>Conectados com a sua saúde</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15, maxWidth: 380 }}>Seus dados de saúde, no cuidado de quem te acompanha.</div>
          <p style={{ fontSize: 14, opacity: 0.85, marginTop: 14, maxWidth: 360, lineHeight: 1.6 }}>Conecte seu wearable e compartilhe atividade, sono e sinais vitais com sua equipe clínica de forma segura.</p>
          <div className="row gap8" style={{ marginTop: 24, flexWrap: 'wrap' }}>
            {(['garmin', 'apple', 'whoop', 'oura', 'fitbit', 'strava'] as const).map((d) => (
              <DeviceBadge key={d} device={d} size={34} />
            ))}
          </div>
        </div>
        <div className="row gap16" style={{ fontSize: 12, opacity: 0.8 }}>
          <span className="row gap6"><Icon n="shield" size={14} />LGPD</span>
          <span className="row gap6"><Icon n="lock" size={14} />Criptografia ponta a ponta</span>
        </div>
        <div style={{ position: 'absolute', right: -80, top: -80, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,.08)' }} />
      </div>
      <div style={{ display: 'grid', placeItems: 'center', padding: 32 }}>
        <form onSubmit={submit} style={{ width: '100%', maxWidth: 360 }}>
          <h2 style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em' }}>Entrar na sua conta</h2>
          <p className="muted" style={{ marginTop: 4, marginBottom: 24 }}>Acesse para conectar seu dispositivo.</p>
          <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 6 }}>E-mail</label>
          <div className="search" style={{ marginBottom: 14, minWidth: 0 }}>
            <Icon n="mail" size={16} />
            <input type="email" required placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 6 }}>Senha</label>
          <div className="search" style={{ marginBottom: 8, minWidth: 0 }}>
            <Icon n="lock" size={16} />
            <input type="password" required placeholder="••••••••" value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          {erro && <p style={{ color: 'var(--crit)', fontSize: 12.5, margin: '4px 0 8px' }}>{erro}</p>}
          <div className="between" style={{ marginBottom: 18 }}>
            <label className="row gap6" style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              <input type="checkbox" defaultChecked />
              Lembrar de mim
            </label>
            <a style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}>Esqueci a senha</a>
          </div>
          <button type="submit" className="btn primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? <span className="spin" style={{ width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} /> : 'Entrar'}
            {!busy && <Icon n="arrowRight" size={16} />}
          </button>
          <div className="row gap10" style={{ margin: '18px 0', color: 'var(--text-faint)', fontSize: 12 }}>
            <div className="grow" style={{ height: 1, background: 'var(--border)' }} />
            ou continue com
            <div className="grow" style={{ height: 1, background: 'var(--border)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button type="button" className="btn ghost" onClick={() => oauth('apple')}>
              <DeviceBadge device="apple" size={18} />
              Apple
            </button>
            <button type="button" className="btn ghost" onClick={() => oauth('google')}>
              <DeviceBadge device="google" size={18} />
              Google
            </button>
          </div>
          <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 20 }}>
            Não tem conta? <a style={{ color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}>Receba o convite da sua clínica</a>
          </p>
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-faint)', marginTop: 14 }}>
            É da equipe da clínica? <a href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Acesse o painel da clínica</a>
          </p>
        </form>
      </div>
    </div>
  );
}
