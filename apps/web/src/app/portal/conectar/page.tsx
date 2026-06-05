'use client';
/* IC Clínica — Portal do paciente: conectar wearable via ROOK Connection Page */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons';
import { DeviceBadge, ConsentStatus } from '@/components/ui';
import { DEVICES, type DeviceKey } from '@/lib/clinic-data';
import { apiFetch } from '@/lib/api';
import { getSupabase } from '@/lib/supabase';

function Logo({ size = 34 }: { size?: number }) {
  return (
    <div className="sb-logo" style={{ width: size, height: size, borderRadius: size * 0.29 }}>
      <Icon n="pulse" size={size * 0.55} strokeWidth={2.4} />
    </div>
  );
}

const DEV_DATA: Record<DeviceKey, string[]> = {
  garmin: ['Atividade', 'FC', 'Sono', 'Estresse', 'VO₂ máx'],
  apple: ['Passos', 'FC', 'Sono', 'Treinos'],
  samsung: ['Passos', 'FC', 'Sono', 'SpO₂'],
  fitbit: ['Passos', 'FC', 'Sono', 'Calorias'],
  oura: ['Sono', 'HRV', 'Temperatura', 'Prontidão'],
  whoop: ['Recuperação', 'HRV', 'Sono', 'Esforço'],
  polar: ['FC', 'Treinos', 'Recuperação'],
  strava: ['Corridas', 'Pedaladas', 'Calorias'],
  google: ['Passos', 'Atividade', 'FC'],
};

export default function ConnectWearablePage() {
  const router = useRouter();
  const [connectionUrl, setConnectionUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(true);
  const [connectedSources, setConnectedSources] = useState<string[]>([]);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    async function init() {
      // Garante que há sessão ativa antes de gerar a URL
      const { data: { user: supaUser } } = await getSupabase().auth.getUser();
      if (!supaUser) { router.push('/portal/login'); return; }
      if (supaUser.email) setUserName(supaUser.email.split('@')[0]);

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const redirectUrl = `${origin}/portal/conectado`;

      try {
        const { url } = await apiFetch<{ url: string }>(
          `/rook/connection-url?redirect_url=${encodeURIComponent(redirectUrl)}`,
        );
        setConnectionUrl(url);
      } catch {
        // Fallback direto: usa UUID sandbox + user_id real do Supabase (nunca "demo")
        const clientUuid =
          process.env.NEXT_PUBLIC_ROOK_CLIENT_UUID ??
          '5e8699f1-f39b-41eb-972d-77cd9c1d76bb';
        setConnectionUrl(
          `https://connections.rook-connect.review/client_uuid/${clientUuid}/user_id/${encodeURIComponent(supaUser.id)}`,
        );
      }

      try {
        const res = await apiFetch<{ data_sources: { data_source: string; authorized: boolean }[] }>('/rook/data-sources');
        setConnectedSources(res.data_sources.filter((s) => s.authorized).map((s) => s.data_source));
      } catch {
        // ignora — sem status de conexão disponível ainda
      }

      setLoadingUrl(false);
    }
    init();
  }, []);

  function openRookConnection() {
    if (connectionUrl) window.location.href = connectionUrl;
  }

  const steps: [string, boolean][] = [
    ['Login', true],
    ['Conectar dispositivo', connectedSources.length > 0],
    ['Consentimento', connectedSources.length > 0],
    ['Pronto', false],
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
          {connectedSources.length > 0 && (
            <span className="badge good">
              <span className="bdot" />
              {connectedSources.length + ' conectado(s)'}
            </span>
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

      <div style={{ maxWidth: 920, margin: '0 auto', padding: '32px 24px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div className="eyebrow" style={{ color: 'var(--accent)' }}>
            {userName ? `Bem-vindo, ${userName} 👋` : 'Bem-vindo 👋'}
          </div>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', textAlign: 'center' }}>Conecte seu wearable</h1>
        <p className="muted" style={{ textAlign: 'center', maxWidth: 520, margin: '8px auto 0', lineHeight: 1.6 }}>
          Clique em <strong>Abrir página de conexão</strong> para autorizar seu dispositivo. Seus dados são enviados de forma segura para sua equipe clínica.
        </p>

        <div className="row gap10" style={{ justifyContent: 'center', margin: '22px 0 28px' }}>
          {steps.map((s, i, arr) => (
            <span key={i} style={{ display: 'contents' }}>
              <div className="row gap8">
                <div style={{ width: 22, height: 22, borderRadius: 50, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, background: s[1] ? 'var(--accent)' : 'var(--surface-3)', color: s[1] ? 'var(--on-accent)' : 'var(--text-faint)' }}>
                  {s[1] ? <Icon n="check" size={13} /> : i + 1}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: s[1] ? 'var(--text)' : 'var(--text-faint)' }}>{s[0]}</span>
              </div>
              {i < arr.length - 1 && <div style={{ width: 26, height: 1.5, background: 'var(--border)' }} />}
            </span>
          ))}
        </div>

        <div className="card" style={{ padding: 32, textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Página de Conexão de Dispositivos</h2>
          <p className="muted" style={{ fontSize: 13, maxWidth: 440, margin: '0 auto 24px', lineHeight: 1.6 }}>
            Conecte seu Garmin, Polar, Fitbit, Oura, WHOOP e outros dispositivos de forma segura através do ROOK Connect.
          </p>
          <div className="row gap8" style={{ justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
            {(['garmin', 'oura', 'polar', 'fitbit', 'whoop'] as DeviceKey[]).map((d) => (
              <DeviceBadge key={d} device={d} size={36} />
            ))}
            <span style={{ fontSize: 12, color: 'var(--text-faint)', alignSelf: 'center' }}>+ mais</span>
          </div>
          <button
            className="btn primary"
            style={{ minWidth: 220 }}
            onClick={openRookConnection}
            disabled={loadingUrl || !connectionUrl}
          >
            {loadingUrl ? (
              <>
                <span className="spin" style={{ width: 15, height: 15, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} />
                Preparando…
              </>
            ) : (
              <>
                <Icon n="plug" size={16} />
                Abrir página de conexão
                <Icon n="arrowRight" size={15} />
              </>
            )}
          </button>
          {connectionUrl && (
            <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 10 }}>
              Você será redirecionado para a página segura do ROOK Connect.
            </p>
          )}
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', marginBottom: 24 }}>
          {(Object.keys(DEVICES) as DeviceKey[]).map((d) => {
            const connected = connectedSources.includes(DEVICES[d].name);
            return (
              <div key={d} className="card" style={{ padding: 16, borderColor: connected ? 'var(--accent)' : 'var(--border)', borderWidth: connected ? 1.5 : 1, transition: 'border-color .2s' }}>
                <div className="between" style={{ marginBottom: 12 }}>
                  <div className="row gap10">
                    <DeviceBadge device={d} size={40} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{DEVICES[d].name}</div>
                      {connected && (
                        <div className="row gap6" style={{ fontSize: 11, color: 'var(--good)', fontWeight: 600 }}>
                          <span style={{ width: 6, height: 6, borderRadius: 50, background: 'var(--good)' }} />
                          Autorizado
                        </div>
                      )}
                    </div>
                  </div>
                  {connected && <Icon n="check" size={18} style={{ color: 'var(--good)' }} />}
                </div>
                <div className="row gap6 wrap">
                  {DEV_DATA[d].map((s) => (
                    <span key={s} style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <ConsentStatus granted={connectedSources.length > 0} scopes={connectedSources.length > 0 ? ['Atividade física', 'Frequência cardíaca', 'Sono', 'Calorias'] : null} />
          <div className="card card-pad">
            <div className="row gap8" style={{ marginBottom: 10 }}>
              <Icon n="lock" size={17} style={{ color: 'var(--accent)' }} />
              <span style={{ fontWeight: 700, fontSize: 13 }}>Privacidade & controle</span>
            </div>
            <ul style={{ listStyle: 'none', display: 'grid', gap: 8 }}>
              {['Você decide quais dados compartilhar', 'Pode revogar o acesso a qualquer momento', 'Dados usados apenas pela sua equipe clínica', 'Conformidade com a LGPD'].map((t, i) => (
                <li key={i} className="row gap8" style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  <Icon n="check" size={14} style={{ color: 'var(--good)', flexShrink: 0 }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="between" style={{ marginTop: 24, flexWrap: 'wrap', gap: 12 }}>
          <button className="btn ghost" onClick={async () => { await getSupabase().auth.signOut(); router.push('/portal/login'); }}>
            <Icon n="logout" size={15} />
            Sair
          </button>
          <button className="btn primary" onClick={() => router.push('/clinica')}>
            {connectedSources.length > 0 ? 'Concluir e ver meu painel' : 'Pular por agora'}
            <Icon n="arrowRight" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
