'use client';

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    try {
      const { error } = await getSupabase().auth.signInWithPassword({
        email,
        password: senha,
      });
      if (error) throw error;
      window.location.href = '/clinica/pacientes';
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha no login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 380, margin: '0 auto', padding: '4rem 1.5rem' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>
        Entrar — Clínica IC
      </h1>
      <form onSubmit={handleLogin} style={{ display: 'grid', gap: '0.75rem' }}>
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          style={inputStyle}
        />
        {erro && <p style={{ color: '#c0392b', margin: 0 }}>{erro}</p>}
        <button type="submit" disabled={loading} style={btnStyle}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '0.65rem 0.8rem',
  borderRadius: 8,
  border: '1px solid #d5d5d5',
  fontSize: '1rem',
};

const btnStyle: React.CSSProperties = {
  padding: '0.7rem',
  borderRadius: 8,
  border: 'none',
  background: '#111',
  color: '#fff',
  fontSize: '1rem',
  cursor: 'pointer',
};
