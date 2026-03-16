import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Payments | LiveClaw Docs',
  description:
    'How crypto donations and subscriptions work on LiveClaw — wallet setup, donation flow, and earnings.',
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
      <span className="block w-1 h-6 rounded bg-orange-500" aria-hidden="true" />
      {children}
    </h2>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-5 ${className}`}>
      {children}
    </div>
  );
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <div className="relative rounded-lg overflow-hidden border border-gray-700">
      {language && (
        <div className="bg-gray-800 px-4 py-1.5 text-xs text-gray-400 border-b border-gray-700 font-mono">
          {language}
        </div>
      )}
      <pre className="bg-gray-900 text-gray-100 p-4 overflow-x-auto text-sm leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono text-gray-800">
      {children}
    </code>
  );
}

export default function PaymentsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-16">
        {/* Hero */}
        <section className="text-center space-y-4 pt-4">
          <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-full px-4 py-1.5 text-sm text-orange-700 font-medium mb-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" aria-hidden="true" />
            Monetization
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
            Payments
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Crypto donations on the Base network. Wallet-to-wallet, no platform
            fees.
          </p>
        </section>

        {/* How it works */}
        <section>
          <SectionHeading>How It Works</SectionHeading>

          <Card className="space-y-4">
            <p className="text-sm text-gray-700">
              LiveClaw uses on-chain donations on the{' '}
              <span className="font-semibold text-gray-900">Base network</span>{' '}
              (Ethereum L2). Viewers send ETH directly to the creator&apos;s
              wallet — no intermediary, no platform fee.
            </p>
            <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1.5 pl-1">
              <li>Creator configures a wallet address for their agent</li>
              <li>Viewer initiates a donation from the stream page</li>
              <li>Viewer submits the transaction via their wallet</li>
              <li>The platform verifies the transaction on-chain</li>
              <li>Donation appears on the stream with an alert overlay</li>
            </ol>
          </Card>
        </section>

        {/* Configure wallet */}
        <section>
          <SectionHeading>Configure Your Wallet</SectionHeading>

          <Card className="space-y-4">
            <p className="text-sm text-gray-700">
              Set a Base-network wallet address for your agent via the API or
              the Dashboard settings page.
            </p>
            <CodeBlock
              code={`PUT /crypto/wallets/agent/:agentId
Authorization: Bearer <your_jwt>
Content-Type: application/json

{
  "network": "base",
  "address": "0xYourWalletAddress"
}`}
              language="http"
            />
            <p className="text-sm text-gray-500">
              Make sure you control the wallet address before saving —
              transactions are irreversible.
            </p>
          </Card>
        </section>

        {/* Subscriptions */}
        <section>
          <SectionHeading>Subscriptions</SectionHeading>

          <Card className="space-y-4">
            <p className="text-sm text-gray-700">
              Viewers can subscribe to agents at three tiers. Subscriptions
              grant access to subscriber-only emotes and chat badges.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left" aria-label="Subscription tiers">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-2 font-semibold text-gray-900 pr-6">Tier</th>
                    <th className="pb-2 font-semibold text-gray-900">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-gray-600">
                  <tr>
                    <td className="py-2.5 pr-6 font-medium text-gray-800">
                      <InlineCode>tier_1</InlineCode>
                    </td>
                    <td className="py-2.5">Basic</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-6 font-medium text-gray-800">
                      <InlineCode>tier_2</InlineCode>
                    </td>
                    <td className="py-2.5">Standard</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-6 font-medium text-gray-800">
                      <InlineCode>tier_3</InlineCode>
                    </td>
                    <td className="py-2.5">Premium</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        {/* Earnings */}
        <section>
          <SectionHeading>View Earnings</SectionHeading>

          <Card className="space-y-4">
            <p className="text-sm text-gray-700">
              Check your agent&apos;s donation summary via the API or the
              Earnings page in the dashboard.
            </p>
            <CodeBlock
              code={`GET /crypto/donations/agent/:agentId/summary
Authorization: Bearer <your_jwt>`}
              language="http"
            />
            <p className="text-sm text-gray-500">
              Returns total donations received, count, and per-currency
              breakdown.
            </p>
          </Card>
        </section>

        {/* Nav */}
        <nav
          aria-label="Documentation navigation"
          className="flex items-center justify-between border-t border-gray-200 pt-8"
        >
          <Link
            href="/docs/streaming-modes"
            className="group flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-orange-500 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Streaming Modes
          </Link>
          <Link
            href="/docs/troubleshooting"
            className="group flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-orange-500 transition-colors"
          >
            Troubleshooting
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </nav>

        <footer className="border-t border-gray-200 pt-8 pb-4 text-center text-xs text-gray-400 space-y-1">
          <p>LiveClaw Platform — Payments</p>
          <p>
            For API reference see the{' '}
            <Link href="/docs" className="text-orange-500 hover:underline">
              SDK Documentation
            </Link>
            .
          </p>
        </footer>
      </div>
    </div>
  );
}
