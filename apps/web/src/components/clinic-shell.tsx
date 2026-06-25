'use client';
/* IC Clínica — App shell: sidebar + topbar + conteúdo. Roteamento real (Next). */
import { useState, useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from './icons';
import { useTheme } from './theme-provider';
import { loadAlerts } from '@/lib/alerts-source';
import { getSupabase } from '@/lib/supabase';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: boolean;
  match: (path: string) => boolean;
}

interface NavGroup {
  sec: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    sec: 'Clínica',
    items: [
      { href: '/clinica', label: 'Dashboard', icon: 'grid', match: (p) => p === '/clinica' },
      { href: '/clinica/pacientes', label: 'Pacientes', icon: 'users', match: (p) => p.startsWith('/clinica/pacientes') },
      { href: '/clinica/alertas', label: 'Alertas', icon: 'bell', badge: true, match: (p) => p.startsWith('/clinica/alertas') },
      { href: '/clinica/relatorios', label: 'Relatórios', icon: 'file', match: (p) => p.startsWith('/clinica/relatorios') },
      { href: '/clinica/equipe', label: 'Equipe', icon: 'users', match: (p) => p.startsWith('/clinica/equipe') },
    ],
  },
  {
    sec: 'Portal do paciente',
    items: [
      { href: '/portal/conectar', label: 'Conectar wearable', icon: 'plug', match: (p) => p.startsWith('/portal/conectar') },
      { href: '/portal/refeicao', label: 'Registrar refeição', icon: 'flame', match: (p) => p.startsWith('/portal/refeicao') },
      { href: '/portal/login', label: 'Login do paciente', icon: 'user', match: (p) => p.startsWith('/portal/login') },
    ],
  },
];

function titleFor(path: string): string {
  if (path === '/clinica') return 'Dashboard';
  if (path.includes('/metas')) return 'Metas';
  if (path.startsWith('/clinica/pacientes/')) return 'Perfil do paciente';
  if (path.startsWith('/clinica/pacientes')) return 'Pacientes';
  if (path.startsWith('/clinica/alertas')) return 'Central de alertas';
  if (path.startsWith('/clinica/relatorios')) return 'Relatórios';
  if (path.startsWith('/clinica/equipe')) return 'Equipe';
  if (path.startsWith('/clinica/perfil')) return 'Meu perfil';
  return 'IC Clínica';
}

function Sidebar({ critCount, open, onClose, userName, userRole, onLogout }: {
  critCount: number; open: boolean; onClose: () => void;
  userName: string; userRole: string; onLogout: () => void;
}) {
  const pathname = usePathname();
  const initials = userName
    ? userName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <>
      {open && <div className="scrim" onClick={onClose} />}
      <aside className={'sidebar' + (open ? ' open' : '')}>
        <div className="sb-brand">
          <div className="sb-logo">
            <Icon n="pulse" size={19} strokeWidth={2.4} />
          </div>
          <div>
            <div className="sb-brand-name">IC Clínica</div>
            <div className="sb-brand-tag">Conectados com a sua saúde</div>
          </div>
        </div>
        <nav className="sb-nav">
          {NAV.map((g, gi) => (
            <div key={gi}>
              <div className="sb-section-label">{g.sec}</div>
              {g.items.map((it) => (
                <Link key={it.href} href={it.href} className={'sb-item' + (it.match(pathname) ? ' active' : '')} onClick={onClose}>
                  <Icon n={it.icon} size={18} />
                  <span className="grow">{it.label}</span>
                  {it.badge && critCount > 0 && <span className="sb-badge">{critCount}</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sb-foot">
          <div className="card" style={{ padding: 11, background: 'var(--accent-soft)', border: 'none', marginBottom: 8 }}>
            <div className="between" style={{ color: 'var(--accent-ink)', marginBottom: 5 }}>
              <span className="row gap6" style={{ fontWeight: 700, fontSize: 12 }}>
                <Icon n="sparkle" size={14} />
                ROOK API
              </span>
              <span className="row gap6" style={{ fontSize: 10.5, fontWeight: 700 }}>
                <span style={{ width: 6, height: 6, borderRadius: 50, background: 'currentColor' }} />
                ativa
              </span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--accent-ink)', opacity: 0.8, lineHeight: 1.4 }}>9 integrações · sync em tempo real</div>
          </div>
          <div className="sb-user">
            <div className="avatar" style={{ width: 34, height: 34, background: 'var(--accent)', fontSize: 13 }}>
              {initials}
            </div>
            <div className="grow" style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userName || 'Usuário'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{userRole}</div>
            </div>
            <Link href="/clinica/perfil" className="icon-btn" title="Meu perfil" onClick={onClose}>
              <Icon n="settings" size={16} style={{ color: 'var(--text-faint)' }} />
            </Link>
            <button className="icon-btn" title="Sair" onClick={onLogout} style={{ color: 'var(--text-faint)' }}>
              <Icon n="logout" size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  medico: 'Médico(a)',
  nutri: 'Nutricionista',
  recepcao: 'Recepção',
};

export function ClinicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [sbOpen, setSbOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [critCount, setCritCount] = useState(0);

  useEffect(() => {
    getSupabase().auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return; }
    });
    // contagem real de alertas críticos abertos (fallback demo)
    loadAlerts().then((al) => {
      if (al) {
        setCritCount(
          al.filter((a) => a.item.level === 'crit' && a.item.status === 'open').length,
        );
      }
    });
    // Load profile name/role from API if available
    import('@/lib/api').then(({ apiFetch }) =>
      apiFetch<{ nome: string; role: string }>('/users/me')
        .then((p) => { setUserName(p.nome); setUserRole(ROLE_LABELS[p.role] ?? p.role); })
        .catch(() => {
          getSupabase().auth.getUser().then(({ data }) => {
            if (data.user?.email) setUserName(data.user.email.split('@')[0]);
          });
        })
    );
  }, [router]);

  async function handleLogout() {
    await getSupabase().auth.signOut();
    router.push('/login');
  }

  return (
    <div className="app">
      <Sidebar
        critCount={critCount}
        open={sbOpen}
        onClose={() => setSbOpen(false)}
        userName={userName}
        userRole={userRole}
        onLogout={handleLogout}
      />
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setSbOpen(true)}>
            <Icon n="menu" size={19} />
          </button>
          <h1>{titleFor(pathname)}</h1>
          <div className="grow" />
          <div className="search hide-sm">
            <Icon n="search" size={16} />
            <input placeholder="Buscar paciente, alerta…" />
            <kbd>⌘K</kbd>
          </div>
          <button className="icon-btn" onClick={toggle} title="Alternar tema">
            <Icon n={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>
          <button className="icon-btn" onClick={() => router.push('/clinica/alertas')} title="Alertas">
            <Icon n="bell" size={18} />
            {critCount > 0 && <span className="dot" />}
          </button>
          <div className="vdivider" style={{ height: 24, margin: '0 4px' }} />
          <button className="btn ghost sm" onClick={() => router.push('/portal/login')}>
            <Icon n="user" size={15} />
            <span className="hide-sm">Portal do paciente</span>
          </button>
          <button className="icon-btn" title="Sair" onClick={handleLogout}>
            <Icon n="logout" size={18} />
          </button>
        </header>
        <div className="content">
          <div key={pathname} className="fade-in">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
