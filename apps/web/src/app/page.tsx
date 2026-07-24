'use client';
/* IC Clínica — Entrada: escolha clara entre equipe e paciente.
   Se já estiver logado, encaminha para a área certa pelo papel do usuário. */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons';
import { getSupabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function route() {
      try {
        const { data: { user } } = await getSupabase().auth.getUser();
        if (!user) { setChecking(false); return; }
        const { fetchRole, isStaffRole } = await import('@/lib/auth-route');
        const role = await fetchRole();
        if (role === 'paciente') { router.replace('/portal/painel'); return; }
        if (isStaffRole(role)) { router.replace('/clinica'); return; }
        setChecking(false);
      } catch {
        setChecking(false);
      }
    }
    void route();
  }, [router]);

  if (checking) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
        <span className="spin" style={{ width: 30, height: 30, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24, background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div className="row gap12" style={{ justifyContent: 'center', marginBottom: 8 }}>
          <div className="sb-logo" style={{ width: 44, height: 44 }}>
            <Icon n="pulse" size={24} strokeWidth={2.4} />
          </div>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', textAlign: 'center' }}>IC Clínica</h1>
        <p className="muted" style={{ textAlign: 'center', marginTop: 6, marginBottom: 28 }}>
          Conectados com a sua saúde. Escolha como deseja entrar.
        </p>

        <div style={{ display: 'grid', gap: 14 }}>
          <button className="card card-pad" onClick={() => router.push('/portal/login')}
            style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'center', border: '1.5px solid var(--border)' }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--accent-soft)', display: 'grid', placeItems: 'center' }}>
              <Icon n="user" size={22} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Sou paciente</div>
              <div className="muted" style={{ fontSize: 12.5 }}>Ver meu painel, conectar meu relógio e registrar refeições.</div>
            </div>
            <Icon n="arrowRight" size={18} style={{ color: 'var(--text-faint)' }} />
          </button>

          <button className="card card-pad" onClick={() => router.push('/login')}
            style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'center', border: '1.5px solid var(--border)' }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--surface-2)', display: 'grid', placeItems: 'center' }}>
              <Icon n="pulse" size={22} style={{ color: 'var(--text)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Sou da equipe da clínica</div>
              <div className="muted" style={{ fontSize: 12.5 }}>Médico, enfermeiro, nutricionista ou recepção.</div>
            </div>
            <Icon n="arrowRight" size={18} style={{ color: 'var(--text-faint)' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
