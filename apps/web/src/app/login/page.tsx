'use client';
/* IC Clínica — Login da equipe (autenticação real via Supabase) */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons';
import { getSupabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
      router.push('/clinica');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha no login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="portal-root" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24, background: 'var(--bg)' }}>
      <div className="card" style={{ width: '100%', maxWidth: 380, padding: 32, boxShadow: 'var(--shadow-lg)' }}>
        <div className="row gap12" style={{ marginBottom: 22 }}>
          <div className="sb-logo" style={{ width: 38, height: 38 }}>
            <Icon n="pulse" size={21} strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>IC Clínica</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Painel da clínica</div>
          </div>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Entrar</h1>
        <p className="muted" style={{ marginTop: 4, marginBottom: 22, fontSize: 13 }}>Acesse o painel da equipe.</p>
        <form onSubmit={handleLogin}>
          <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 6 }}>E-mail</label>
          <div className="search" style={{ marginBottom: 14, minWidth: 0 }}>
            <Icon n="mail" size={16} />
            <input type="email" required placeholder="voce@clinica.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 6 }}>Senha</label>
          <div className="search" style={{ marginBottom: 8, minWidth: 0 }}>
            <Icon n="lock" size={16} />
            <input type="password" required placeholder="••••••••" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
          {erro && <p style={{ color: 'var(--crit)', fontSize: 12.5, margin: '4px 0 8px' }}>{erro}</p>}
          <button type="submit" className="btn primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? <span className="spin" style={{ width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} /> : 'Entrar'}
            {!loading && <Icon n="arrowRight" size={16} />}
          </button>
        </form>
        <button type="button" className="btn ghost sm" style={{ width: '100%', marginTop: 16 }} onClick={() => router.push('/clinica')}>
          Ver painel (demonstração)
          <Icon n="arrowRight" size={14} />
        </button>
      </div>
    </div>
  );
}
