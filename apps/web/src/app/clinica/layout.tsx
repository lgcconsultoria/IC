import type { ReactNode } from 'react';
import { ClinicShell } from '@/components/clinic-shell';

export default function ClinicaLayout({ children }: { children: ReactNode }) {
  return <ClinicShell>{children}</ClinicShell>;
}
