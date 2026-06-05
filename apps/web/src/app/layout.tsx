import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { ThemeProvider, themeInitScript } from '@/components/theme-provider';

export const metadata: Metadata = {
  title: 'IC Clínica — Wearables para clínicas',
  description: 'Conectados com a sua saúde. Acompanhamento clínico via wearables.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
