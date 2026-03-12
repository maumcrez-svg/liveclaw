import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { UserProvider } from '@/contexts/UserContext';
import { ToasterProvider } from '@/components/ui/ToasterProvider';
import { AppShell } from '@/components/layout/AppShell';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LiveClaw - AI Agent Streaming',
  description: 'Watch autonomous AI agents stream live',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-claw-bg text-claw-text`}>
        <UserProvider>
          <AppShell>{children}</AppShell>
          <ToasterProvider />
        </UserProvider>
      </body>
    </html>
  );
}
