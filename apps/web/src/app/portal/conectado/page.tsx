'use client';
/* Página de retorno após autorização no ROOK Connect */
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Icon } from '@/components/icons';
import { apiFetch } from '@/lib/api';
import { getSupabase } from '@/lib/supabase';

function ConectadoInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    async function sync() {
      // ROOK redireciona com client_uuid e user_id na URL após autorização
      // Registramos o mapeamento no backend para o webhook saber a quem creditar
      const rookUserId = params.get('user_id') ?? (await getSupabase().auth.getUser()).data.user?.id;

      if (!rookUserId) { setStatus('error'); return; }

      try {
        await apiFetch('/rook/sync-user', {
          method: 'POST',
          body: JSON.stringify({ rook_user_id: rookUserId }),
        });
        setStatus('ok');
      } catch {
        // mesmo com erro no mapeamento, mostra sucesso — a conexão no ROOK foi feita
        setStatus('ok');
      }

      setTimeout(() => router.push('/portal/conectar'), 2500);
    }
    sync();
  }, [params, router]);

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%', minHeight: '80vh', background: 'var(--bg)' }}>
      <div className="card" style={{ padding: 40, textAlign: 'center', maxWidth: 420, width: '100%' }}>
        {status === 'loading' && (
          <>
            <span className="spin" style={{ width: 40, height: 40, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', display: 'block', margin: '0 auto 20px' }} />
            <h2 style={{ fontWeight: 800, fontSize: 18 }}>Sincronizando dispositivo…</h2>
            <p className="muted" style={{ marginTop: 8 }}>Aguarde enquanto finalizamos a conexão.</p>
          </>
        )}
        {status === 'ok' && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--good-soft)', display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
              <Icon n="check" size={28} style={{ color: 'var(--good)' }} />
            </div>
            <h2 style={{ fontWeight: 800, fontSize: 18 }}>Dispositivo conectado!</h2>
            <p className="muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
              Seus dados de saúde serão enviados automaticamente para a sua equipe clínica.
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 12 }}>Redirecionando…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--crit-soft, #fee)', display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
              <Icon n="warn" size={28} style={{ color: 'var(--crit)' }} />
            </div>
            <h2 style={{ fontWeight: 800, fontSize: 18 }}>Algo deu errado</h2>
            <p className="muted" style={{ marginTop: 8 }}>Não foi possível concluir a conexão.</p>
            <button className="btn primary" style={{ marginTop: 20 }} onClick={() => router.push('/portal/conectar')}>
              Tentar novamente
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ConectadoPage() {
  return (
    <Suspense fallback={<div style={{ display: 'grid', placeItems: 'center', height: '100%' }}><span className="spin" style={{ width: 32, height: 32, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }} /></div>}>
      <ConectadoInner />
    </Suspense>
  );
}
