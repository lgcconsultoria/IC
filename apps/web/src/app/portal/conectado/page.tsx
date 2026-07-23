'use client';
/* Rota legada do fluxo OAuth (ROOK). O Garmin conecta inline em /portal/conectar,
   então esta página apenas redireciona para lá. */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ConectadoPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/portal/conectar');
  }, [router]);

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%', minHeight: '60vh' }}>
      <span className="spin" style={{ width: 32, height: 32, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }} />
    </div>
  );
}
