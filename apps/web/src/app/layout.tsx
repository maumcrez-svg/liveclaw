import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';
import { UserProvider } from '@/contexts/UserContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
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

const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='light')return;document.documentElement.classList.add('dark')}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.className} bg-claw-bg text-claw-text`}>
        <ThemeProvider>
          <UserProvider>
            <AppShell>{children}</AppShell>
            <ToasterProvider />
          </UserProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
