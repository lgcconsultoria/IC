'use client';
/* Perfil da equipe — editar dados pessoais, CRM, especialidade */
import { useState, useEffect } from 'react';
import { Icon } from '@/components/icons';
import { getSupabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';

interface ProfileData {
  nome: string;
  email: string;
  phone: string;
  crm: string;
  especialidade: string;
  role: string;
}

const ROLES: Record<string, string> = {
  admin: 'Administrador',
  medico: 'Médico(a)',
  nutri: 'Nutricionista',
  recepcao: 'Recepção',
  paciente: 'Paciente',
};

export default function PerfilPage() {
  const [form, setForm] = useState<ProfileData>({ nome: '', email: '', phone: '', crm: '', especialidade: '', role: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pwForm, setPwForm] = useState({ atual: '', nova: '', confirmar: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await getSupabase().auth.getUser();
      if (!user) return;
      try {
        const profile = await apiFetch<ProfileData>('/users/me');
        setForm(profile);
      } catch {
        setForm(f => ({ ...f, email: user.email ?? '' }));
      }
      setLoading(false);
    }
    load();
  }, []);

  function set(k: keyof ProfileData, v: string) {
    setForm(f => ({ ...f, [k]: v }));
    setSaved(false);
    setSaveError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await apiFetch('/users/me', { method: 'PATCH', body: JSON.stringify(form) });
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.nova !== pwForm.confirmar) {
      setPwMsg({ ok: false, msg: 'As senhas não coincidem.' });
      return;
    }
    setPwSaving(true);
    const { error } = await getSupabase().auth.updateUser({ password: pwForm.nova });
    setPwMsg(error ? { ok: false, msg: error.message } : { ok: true, msg: 'Senha alterada com sucesso.' });
    if (!error) setPwForm({ atual: '', nova: '', confirmar: '' });
    setPwSaving(false);
  }

  if (loading) return <div className="page"><div className="skel" style={{ height: 200, borderRadius: 12 }} /></div>;

  return (
    <div className="page" style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 className="page-title">Meu perfil</h2>
        <div className="muted" style={{ marginTop: 2 }}>Dados pessoais, credenciais e configurações de acesso</div>
      </div>

      {/* Avatar + identidade */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="row gap16" style={{ marginBottom: 20 }}>
          <div className="avatar" style={{ width: 64, height: 64, fontSize: 22, background: 'var(--accent)', flexShrink: 0 }}>
            {form.nome ? form.nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?'}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{form.nome || '—'}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              {ROLES[form.role] ?? form.role}{form.especialidade ? ' · ' + form.especialidade : ''}
              {form.crm ? <span style={{ marginLeft: 8, padding: '1px 8px', borderRadius: 20, background: 'var(--surface-2)', fontSize: 11.5, fontWeight: 600 }}>CRM {form.crm}</span> : null}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>{form.email}</div>
          </div>
        </div>

        <form onSubmit={save}>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 5 }}>Nome completo</label>
              <input className="input" value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Dra. Maria Silva" required />
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 5 }}>E-mail</label>
              <input className="input" value={form.email} disabled style={{ opacity: 0.6 }} />
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 5 }}>Telefone</label>
              <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(11) 99999-0000" />
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 5 }}>Especialidade</label>
              <input className="input" value={form.especialidade} onChange={e => set('especialidade', e.target.value)} placeholder="Cardiologia" />
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 5 }}>CRM / Registro profissional</label>
              <input className="input" value={form.crm} onChange={e => set('crm', e.target.value)} placeholder="123456-SP" />
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 5 }}>Função</label>
              <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
                {Object.entries(ROLES).filter(([k]) => k !== 'paciente').map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="row gap10" style={{ marginTop: 18, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {saveError && <span style={{ fontSize: 12.5, color: 'var(--crit)' }}>{saveError}</span>}
            {saved && <span style={{ fontSize: 12.5, color: 'var(--good)', display: 'flex', alignItems: 'center', gap: 6 }}><Icon n="check" size={14} />Salvo!</span>}
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? <span className="spin" style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} /> : <Icon n="check" size={15} />}
              Salvar alterações
            </button>
          </div>
        </form>
      </div>

      {/* Alterar senha */}
      <div className="card card-pad">
        <div className="row gap8" style={{ marginBottom: 16 }}>
          <Icon n="lock" size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Alterar senha</span>
        </div>
        <form onSubmit={changePassword}>
          <div style={{ display: 'grid', gap: 12, maxWidth: 340 }}>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 5 }}>Nova senha</label>
              <input type="password" className="input" value={pwForm.nova} onChange={e => setPwForm(f => ({ ...f, nova: e.target.value }))} placeholder="Mínimo 8 caracteres" required minLength={8} />
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 5 }}>Confirmar nova senha</label>
              <input type="password" className="input" value={pwForm.confirmar} onChange={e => setPwForm(f => ({ ...f, confirmar: e.target.value }))} placeholder="Repita a senha" required />
            </div>
          </div>
          {pwMsg && (
            <p style={{ fontSize: 12.5, marginTop: 10, color: pwMsg.ok ? 'var(--good)' : 'var(--crit)' }}>{pwMsg.msg}</p>
          )}
          <button type="submit" className="btn ghost" style={{ marginTop: 14 }} disabled={pwSaving}>
            {pwSaving ? 'Alterando…' : 'Alterar senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
