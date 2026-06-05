import type { ReactNode } from 'react';

export default function PortalLayout({ children }: { children: ReactNode }) {
  return <div className="portal-root">{children}</div>;
}
