import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Clínica IC',
  description: 'Plataforma de acompanhamento de emagrecimento saudável',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#f7f7f8',
          color: '#1a1a1a',
        }}
      >
        {children}
      </body>
    </html>
  );
}
