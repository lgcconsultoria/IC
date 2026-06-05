'use client';
/* IC Clínica — Portal do paciente: conectar wearable (fluxo Terra Connect) */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons';
import { DeviceBadge, ConsentStatus } from '@/components/ui';
import { DEVICES, type DeviceKey } from '@/lib/clinic-data';

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
  const [connected, setConnected] = useState<Set<DeviceKey>>(() => new Set<DeviceKey>(['garmin']));
  const [connecting, setConnecting] = useState<DeviceKey | null>(null);

  function connect(d: DeviceKey) {
    setConnecting(d);
    setTimeout(() => {
      setConnected((s) => new Set<DeviceKey>([...s, d]));
      setConnecting(null);
    }, 1200);
  }
  function disconnect(d: DeviceKey) {
    setConnected((s) => {
      const n = new Set(s);
      n.delete(d);
      return n;
    });
  }

  const steps: [string, boolean][] = [
    ['Login', true],
    ['Conectar dispositivo', connected.size > 0],
    ['Consentimento', connected.size > 0],
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
          <span className="badge good">
            <span className="bdot" />
            {connected.size + ' conectado(s)'}
          </span>
          <div className="row gap8" style={{ paddingLeft: 6 }}>
            <div className="avatar" style={{ width: 32, height: 32, background: '#3a6ea5', fontSize: 12 }}>JP</div>
            <button className="icon-btn" onClick={() => router.push('/portal/login')}>
              <Icon n="logout" size={17} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 920, margin: '0 auto', padding: '32px 24px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div className="eyebrow" style={{ color: 'var(--accent)' }}>Bem-vindo, João 👋</div>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', textAlign: 'center' }}>Conecte seu wearable</h1>
        <p className="muted" style={{ textAlign: 'center', maxWidth: 520, margin: '8px auto 0', lineHeight: 1.6 }}>
          Escolha seus aplicativos de saúde. Seus dados são enviados de forma segura para sua equipe clínica acompanhar sua evolução.
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

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', marginBottom: 24 }}>
          {(Object.keys(DEVICES) as DeviceKey[]).map((d) => {
            const on = connected.has(d);
            const loading = connecting === d;
            return (
              <div key={d} className="card" style={{ padding: 16, borderColor: on ? 'var(--accent)' : 'var(--border)', borderWidth: on ? 1.5 : 1, transition: 'border-color .2s' }}>
                <div className="between" style={{ marginBottom: 12 }}>
                  <div className="row gap10">
                    <DeviceBadge device={d} size={40} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{DEVICES[d].name}</div>
                      {on && (
                        <div className="row gap6" style={{ fontSize: 11, color: 'var(--good)', fontWeight: 600 }}>
                          <span style={{ width: 6, height: 6, borderRadius: 50, background: 'var(--good)' }} />
                          Sincronizando
                        </div>
                      )}
                    </div>
                  </div>
                  {on && <Icon n="check" size={18} style={{ color: 'var(--good)' }} />}
                </div>
                <div className="row gap6 wrap" style={{ marginBottom: 14 }}>
                  {DEV_DATA[d].map((s) => (
                    <span key={s} style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                      {s}
                    </span>
                  ))}
                </div>
                {on ? (
                  <button className="btn ghost sm" style={{ width: '100%' }} onClick={() => disconnect(d)}>
                    Desconectar
                  </button>
                ) : (
                  <button className={'btn ' + (loading ? 'ghost' : 'soft') + ' sm'} style={{ width: '100%' }} onClick={() => connect(d)} disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spin" style={{ width: 13, height: 13, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} />
                        Conectando…
                      </>
                    ) : (
                      <>
                        <Icon n="plug" size={14} />
                        Conectar
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <ConsentStatus granted={connected.size > 0} scopes={connected.size > 0 ? ['Atividade física', 'Frequência cardíaca', 'Sono', 'Calorias'] : null} />
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
          <button className="btn ghost" onClick={() => router.push('/portal/login')}>
            <Icon n="chevL" size={15} />
            Sair
          </button>
          <button className="btn primary" disabled={connected.size === 0} onClick={() => router.push('/clinica')}>
            Concluir e ver meu painel
            <Icon n="arrowRight" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
