import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import '../../frontend/src/index.css';

export const metadata: Metadata = {
  title: 'EcoSearch — Small choices. A healthier planet.',
  description: 'Explore real products and request estimated AI sustainability insights. Understand the trade-offs behind everyday choices.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
