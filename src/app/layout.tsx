import type { Metadata } from 'next';
import { IBM_Plex_Mono, Space_Grotesk } from 'next/font/google';

import { cn } from '@/lib/utils';

import './globals.css';

const spaceGrotesk = Space_Grotesk({
  variable: '--font-display',
  subsets: ['latin'],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-mono',
  weight: ['400', '500', '600'],
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'NVIDIA NIM Model Playground',
  description:
    'Switch NVIDIA Integrate API models, tune parameters, and benchmark latency.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        'dark h-full font-sans',
        spaceGrotesk.variable,
        ibmPlexMono.variable,
      )}
    >
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
