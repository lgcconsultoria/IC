'use client';
/* Gestão de equipe — cadastrar e gerenciar funcionários */
import { useState, useEffect } from 'react';
import { Icon } from '@/components/icons';
import { apiFetch } from '@/lib/api';

interface StaffMember {
  id: string;
  nome: string;
  email: string;
  role: string;
  especialidade?: string;
  crm?: string;
  ativo: boolean;
}

const ROLES: Record<string, { label: string; color: string }> = {
  admin:    { label: 'Admin',         color: 'var(--crit)' },
  medico:   { label: 'Médico(a)',     color: 'var(--accent)' },
  nutri:    { label: 'Nutricionista', color: 'var(--good)' },
  recepcao: { label: 'Recepção',      color: 'var(--warn)' },
};

const DEMO_STAFF: StaffMember[] = [
  { id: '1', nome: 'Dra. Marina Costa', email: 'marina@clinica.com', role: 'medico', especialidade: 'Cardiologia', crm: '123456-SP', ativo: true },
  { id: '2', nome: 'Ana Nutrição', email: 'ana@clinica.com', role: 'nutri', especialidade: 'Nutrição Esportiva', crm: '', ativo: true },
  { id: '3', nome: 'Carlos Recepção', email: 'carlos@clinica.com', role: 'recepcao', ativo: true },
];

const EMPTY = { nome: '', email: '', role: 'medico', especialidade: '', crm: '' };

export default function EquipePage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invited, setInvited] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<StaffMember[]>('/users/staff')
      .then(setStaff)
      .catch(() => setStaff(DEMO_STAFF))
      .finally(() => setLoading(false));
  }, []);

  function set(k: keyof typeof EMPTY, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/users/staff', { method: 'POST', body: JSON.stringify(form) });
      setInvited(form.email);
      setShowForm(false);
      setForm(EMPTY);
      // re-fetch
      const updated = await apiFetch<StaffMember[]>('/users/staff');
      setStaff(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao convidar funcionário');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="between" style={{ marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title">Equipe</h2>
          <div className="muted" style={{ marginTop: 2 }}>Gerencie os membros da sua equipe clínica</div>
        </div>
        <button className="btn primary" onClick={() => { setShowForm(true); setError(null); }}>
          <Icon n="plus" size={16} />
          Convidar funcionário
        </button>
      </div>

      {/* Modal de convite */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'grid', placeItems: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: 28 }}>
            <div className="between" style={{ marginBottom: 20 }}>
              <h3 style={{ fontWeight: 800, fontSize: 16 }}>Convidar funcionário</h3>
              <button className="icon-btn" onClick={() => setShowForm(false)}><Icon n="x" size={18} /></button>
            </div>
            <form onSubmit={invite} style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 5 }}>Nome completo *</label>
                <input className="input" required placeholder="Dra. Maria Silva" value={form.nome} onChange={e => set('nome', e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 5 }}>E-mail *</label>
                <input className="input" type="email" required placeholder="maria@clinica.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 5 }}>Função *</label>
                  <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
                    {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 5 }}>Especialidade</label>
                  <input className="input" placeholder="Cardiologia" value={form.especialidade} onChange={e => set('especialidade', e.target.value)} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 5 }}>CRM / Registro</label>
                <input className="input" placeholder="123456-SP" value={form.crm} onChange={e => set('crm', e.target.value)} />
              </div>
              {error && <p style={{ fontSize: 12.5, color: 'var(--crit)' }}>{error}</p>}
              <div className="row gap10" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn primary" disabled={saving}>
                  {saving ? 'Enviando convite…' : <><Icon n="mail" size={15} />Enviar convite</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {invited && (
        <div className="card card-pad" style={{ marginBottom: 16, background: 'var(--good-soft)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <Icon n="check" size={16} style={{ color: 'var(--good)' }} />
          <span style={{ fontSize: 13 }}>Convite enviado para <strong>{invited}</strong>. O funcionário receberá um e-mail para criar a senha.</span>
          <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={() => setInvited(null)}><Icon n="x" size={14} /></button>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {[1,2,3].map(i => <div key={i} className="skel" style={{ height: 68, borderRadius: 12 }} />)}
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Funcionário', 'Função', 'Especialidade / CRM', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background .15s' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div className="row gap10">
                      <div className="avatar" style={{ width: 34, height: 34, fontSize: 12, background: 'var(--accent)', flexShrink: 0 }}>
                        {s.nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{s.nome}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{s.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--surface-2)', color: ROLES[s.role]?.color ?? 'var(--text)' }}>
                      {ROLES[s.role]?.label ?? s.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>
                    {s.especialidade || '—'}
                    {s.crm && <span style={{ marginLeft: 8, fontSize: 11.5, color: 'var(--text-faint)' }}>CRM {s.crm}</span>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={s.ativo ? 'badge good' : 'badge'} style={{ fontSize: 11 }}>
                      {s.ativo ? <><span className="bdot" />Ativo</> : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button className="btn ghost sm"><Icon n="settings" size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {staff.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
              Nenhum funcionário cadastrado ainda.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
