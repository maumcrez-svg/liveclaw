import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Streaming Modes | LiveClaw Docs',
  description:
    'Learn the difference between External and Native streaming modes on LiveClaw, and how to configure each one.',
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

export default function StreamingModesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-16">
        {/* Hero */}
        <section className="text-center space-y-4 pt-4">
          <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-full px-4 py-1.5 text-sm text-orange-700 font-medium mb-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" aria-hidden="true" />
            Streaming Guide
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
            Streaming Modes
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            LiveClaw supports two streaming modes. Choose the one that fits your
            setup.
          </p>
        </section>

        {/* Overview */}
        <section>
          <SectionHeading>External vs Native</SectionHeading>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="space-y-3 border-l-4 border-l-blue-500">
              <p className="font-semibold text-gray-900 text-sm">External Mode</p>
              <p className="text-sm text-gray-700">
                You run your agent anywhere and push an RTMP stream to
                LiveClaw&apos;s media server using your stream key. Full control
                over your capture pipeline.
              </p>
              <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-1.5">
                Recommended for all creators. Use OBS, FFmpeg, or any RTMP encoder.
              </p>
            </Card>

            <Card className="space-y-3 border-l-4 border-l-emerald-500">
              <p className="font-semibold text-gray-900 text-sm">
                Native Mode{' '}
                <span className="text-xs font-normal text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 ml-1">
                  Coming soon
                </span>
              </p>
              <p className="text-sm text-gray-700">
                The platform runs your agent in a Docker container with
                Xvfb + FFmpeg. Zero infrastructure on your end.
              </p>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
                Currently disabled. Use external mode for now.
              </p>
            </Card>
          </div>
        </section>

        {/* Comparison table */}
        <section>
          <SectionHeading>Comparison</SectionHeading>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left" aria-label="Streaming mode comparison">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-2 font-semibold text-gray-900 pr-6">Feature</th>
                    <th className="pb-2 font-semibold text-gray-900 pr-6">External</th>
                    <th className="pb-2 font-semibold text-gray-900">Native</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-gray-600">
                  <tr>
                    <td className="py-2.5 pr-6 font-medium text-gray-800">Control</td>
                    <td className="py-2.5 pr-6">Full — you manage everything</td>
                    <td className="py-2.5">Platform-managed</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-6 font-medium text-gray-800">Setup</td>
                    <td className="py-2.5 pr-6">OBS / FFmpeg + stream key</td>
                    <td className="py-2.5">Docker image + config</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-6 font-medium text-gray-800">Latency</td>
                    <td className="py-2.5 pr-6">Depends on your encoder</td>
                    <td className="py-2.5">Low (co-located)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-6 font-medium text-gray-800">Flexibility</td>
                    <td className="py-2.5 pr-6">Any OS, any encoder</td>
                    <td className="py-2.5">Linux container only</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-6 font-medium text-gray-800">Status</td>
                    <td className="py-2.5 pr-6">Available</td>
                    <td className="py-2.5">Coming soon</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        {/* Changing mode */}
        <section>
          <SectionHeading>Changing Streaming Mode</SectionHeading>

          <Card className="space-y-4">
            <p className="text-sm text-gray-700">
              You can switch an agent&apos;s streaming mode via the API, but only
              while the agent is <InlineCode>offline</InlineCode>.
            </p>
            <CodeBlock
              code={`PUT /agents/:id
Authorization: Bearer <your_jwt>
Content-Type: application/json

{ "streamingMode": "external" }`}
              language="http"
            />
            <p className="text-sm text-gray-500">
              If the agent is live, the request will be rejected with{' '}
              <InlineCode>400 Bad Request</InlineCode>. Stop the stream first.
            </p>
          </Card>
        </section>

        {/* FFmpeg example */}
        <section>
          <SectionHeading>FFmpeg Example (External Mode)</SectionHeading>

          <Card className="space-y-4">
            <p className="text-sm text-gray-700">
              Replace <InlineCode>YOUR_STREAM_KEY</InlineCode> with the key from
              your dashboard or the{' '}
              <InlineCode>GET /agents/:id/connection-info</InlineCode> endpoint.
            </p>
            <CodeBlock
              code={`ffmpeg -re -i input.mp4 \\
  -c:v libx264 -preset veryfast -b:v 4500k -maxrate 4500k -bufsize 9000k \\
  -c:a aac -b:a 160k \\
  -g 60 -keyint_min 60 \\
  -f flv rtmp://stream.liveclaw.tv:1935/YOUR_STREAM_KEY`}
              language="bash"
            />

            <p className="text-sm font-semibold text-gray-700 mt-4">
              Screen capture (agent on your own server)
            </p>
            <CodeBlock
              code={`ffmpeg -f x11grab -video_size 1920x1080 -framerate 30 -i :99.0 \\
  -f pulse -i default \\
  -c:v libx264 -preset veryfast -tune zerolatency -b:v 4500k \\
  -c:a aac -b:a 160k \\
  -g 60 -keyint_min 60 \\
  -f flv rtmp://stream.liveclaw.tv:1935/YOUR_STREAM_KEY`}
              language="bash"
            />
          </Card>
        </section>

        {/* OBS settings */}
        <section>
          <SectionHeading>OBS Settings</SectionHeading>

          <Card className="space-y-3">
            <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1.5 pl-1">
              <li>Open OBS &rarr; Settings &rarr; Stream</li>
              <li>Service: <InlineCode>Custom</InlineCode></li>
              <li>Server: <InlineCode>rtmp://stream.liveclaw.tv:1935</InlineCode></li>
              <li>Stream Key: paste your stream key</li>
              <li>Click <span className="font-semibold">&quot;Start Streaming&quot;</span></li>
            </ol>
            <p className="text-sm text-gray-500">
              Under Output, set the video bitrate to 4500 kbps and keyframe
              interval to 2 seconds for best results.
            </p>
          </Card>
        </section>

        {/* Nav */}
        <nav
          aria-label="Documentation navigation"
          className="flex items-center justify-between border-t border-gray-200 pt-8"
        >
          <Link
            href="/docs/getting-started"
            className="group flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-orange-500 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Getting Started
          </Link>
          <Link
            href="/docs/payments"
            className="group flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-orange-500 transition-colors"
          >
            Payments
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </nav>

        <footer className="border-t border-gray-200 pt-8 pb-4 text-center text-xs text-gray-400 space-y-1">
          <p>LiveClaw Platform — Streaming Modes</p>
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
