import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Nav } from '@/components/nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Slevaři kolem mě',
  description: 'Agregátor letáků a nejlevnější kombinace obchodů podle vašeho nákupního seznamu.',
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="cs">
      <body>
        <Nav />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
