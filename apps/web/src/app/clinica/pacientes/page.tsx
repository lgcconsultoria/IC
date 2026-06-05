'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface PatientRow {
  id: string;
  objetivo: string | null;
  ativo: boolean;
  nome?: { nome: string } | { nome: string }[] | null;
}

function nomeDe(p: PatientRow): string {
  if (!p.nome) return '(sem nome)';
  return Array.isArray(p.nome) ? (p.nome[0]?.nome ?? '—') : p.nome.nome;
}

export default function PacientesPage() {
  const [pacientes, setPacientes] = useState<PatientRow[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setPacientes(await apiFetch<PatientRow[]>('/patients'));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      await apiFetch('/patients', {
        method: 'POST',
        body: JSON.stringify({ nome, email }),
      });
      setNome('');
      setEmail('');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar');
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Pacientes</h1>

      <form
        onSubmit={criar}
        style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}
      >
        <input
          placeholder="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <button type="submit" style={btnStyle}>
          Adicionar
        </button>
      </form>

      {erro && <p style={{ color: '#c0392b' }}>{erro}</p>}
      {carregando ? (
        <p>Carregando...</p>
      ) : pacientes.length === 0 ? (
        <p style={{ color: '#777' }}>Nenhum paciente cadastrado.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.5rem' }}>
          {pacientes.map((p) => (
            <li
              key={p.id}
              style={{
                background: '#fff',
                border: '1px solid #e5e5e5',
                borderRadius: 10,
                padding: '0.9rem 1rem',
              }}
            >
              <strong>{nomeDe(p)}</strong>
              {p.objetivo && (
                <span style={{ color: '#777' }}> — {p.objetivo}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.6rem 0.8rem',
  borderRadius: 8,
  border: '1px solid #d5d5d5',
};

const btnStyle: React.CSSProperties = {
  padding: '0.6rem 1rem',
  borderRadius: 8,
  border: 'none',
  background: '#111',
  color: '#fff',
  cursor: 'pointer',
};
