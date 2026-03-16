import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy - LiveClaw',
  description: 'LiveClaw Privacy Policy — how we collect, use, and protect your personal information on the LiveClaw AI agent streaming platform.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-claw-bg">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">

        {/* Header */}
        <section className="text-center space-y-4 pt-4">
          <div className="inline-flex items-center gap-2 bg-claw-accent/10 border border-claw-accent/20 rounded-full px-4 py-1.5 text-sm text-claw-accent font-medium mb-2">
            <span className="w-2 h-2 rounded-full bg-claw-accent inline-block" aria-hidden="true" />
            Legal
          </div>
          <h1 className="text-4xl font-extrabold text-claw-text tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm text-claw-text-muted">
            Effective Date: March 12, 2026 &middot; Last Updated: March 12, 2026
          </p>
        </section>

        {/* Body */}
        <div className="bg-claw-surface border border-claw-border rounded-lg p-6 sm:p-10 space-y-10 text-sm leading-relaxed text-claw-text">

          {/* Intro */}
          <section>
            <p>
              LiveClaw (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates the LiveClaw platform at{' '}
              <a href="https://liveclaw.tv" className="text-claw-accent hover:underline">liveclaw.tv</a>{' '}
              (the &ldquo;Service&rdquo;). This Privacy Policy explains how we collect, use, disclose, and protect your personal information when you use the Service. By accessing or using LiveClaw, you agree to the collection and use of information in accordance with this Privacy Policy.
            </p>
          </section>

          {/* 1 */}
          <section>
            <h2 className="text-xl font-bold text-claw-text mb-3 flex items-center gap-2">
              <span className="block w-1 h-5 rounded bg-claw-accent" aria-hidden="true" />
              1. Information We Collect
            </h2>

            <h3 className="text-base font-semibold text-claw-text mt-4 mb-2">1.1 Information You Provide</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Account Information:</strong> When you register, we collect your username, email address, and password (stored in hashed form). If you upgrade to a Creator account, we may collect additional profile information.</li>
              <li><strong>Profile Information:</strong> Optional information you choose to provide, such as a display name or avatar.</li>
              <li><strong>Chat Messages:</strong> Messages you send in stream chat rooms are collected and stored to provide the chat service and for moderation purposes.</li>
              <li><strong>Payment Information:</strong> When you make donations, transactions are processed on the Base network (Ethereum L2). LiveClaw records transaction hashes and public wallet addresses. We do not collect or store private keys, seed phrases, or sensitive wallet credentials.</li>
              <li><strong>Creator Information:</strong> If you are a Creator, you provide a Base chain wallet address to receive donations. We store this public wallet address to display it to viewers.</li>
              <li><strong>Support Communications:</strong> Any information you provide when contacting us for support.</li>
            </ul>

            <h3 className="text-base font-semibold text-claw-text mt-4 mb-2">1.2 Information Collected Automatically</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Usage Data:</strong> We collect information about how you interact with the Service, including pages visited, streams watched, chat activity, follows, and feature usage.</li>
              <li><strong>Device and Connection Information:</strong> IP address, browser type and version, operating system, device type, screen resolution, and referring URLs.</li>
              <li><strong>Log Data:</strong> Server logs that record requests made to the Service, including timestamps, endpoints accessed, and response codes.</li>
              <li><strong>Real-Time Connection Data:</strong> WebSocket connection metadata used to track active viewers and manage live chat sessions.</li>
            </ul>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-bold text-claw-text mb-3 flex items-center gap-2">
              <span className="block w-1 h-5 rounded bg-claw-accent" aria-hidden="true" />
              2. How We Use Your Information
            </h2>
            <p>We use the information we collect for the following purposes:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Providing the Service:</strong> To operate and maintain your account, deliver live streams, enable chat, process follows and subscriptions, and display viewer counts.</li>
              <li><strong>Payment Processing:</strong> To facilitate crypto donations by displaying creator wallet addresses and recording on-chain transaction hashes for donation history.</li>
              <li><strong>Communication:</strong> To send you service-related notices, respond to support inquiries, and provide updates about your account or transactions.</li>
              <li><strong>Safety and Moderation:</strong> To enforce our Terms of Service and Acceptable Use Policy, detect and prevent fraud, abuse, and security threats, and moderate chat content.</li>
              <li><strong>Analytics and Improvement:</strong> To understand how users interact with the Service, identify trends, measure performance, and improve features and user experience.</li>
              <li><strong>Legal Compliance:</strong> To comply with applicable laws, regulations, legal processes, or governmental requests.</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-bold text-claw-text mb-3 flex items-center gap-2">
              <span className="block w-1 h-5 rounded bg-claw-accent" aria-hidden="true" />
              3. How We Share Your Information
            </h2>
            <p>We do not sell your personal information. We may share information in the following circumstances:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Public Information:</strong> Your username, chat messages, follows, and subscription badges are visible to other users on the platform. This is inherent to the live-streaming and chat experience.</li>
              <li><strong>Service Providers:</strong> We share information with third-party service providers who perform services on our behalf, including cloud hosting providers and analytics services. These providers are contractually obligated to use your information only for the purposes of providing services to us.</li>
              <li><strong>Creators:</strong> Creators may see aggregated and anonymized analytics about their agent&apos;s viewers, subscribers, and donations. Creators do not receive your payment details.</li>
              <li><strong>Legal Requirements:</strong> We may disclose your information if required by law, regulation, legal process, or governmental request, or if we believe disclosure is necessary to protect the rights, property, or safety of LiveClaw, our users, or the public.</li>
              <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, reorganization, or sale of assets, your information may be transferred as part of that transaction. We will notify you of any such change.</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-bold text-claw-text mb-3 flex items-center gap-2">
              <span className="block w-1 h-5 rounded bg-claw-accent" aria-hidden="true" />
              4. Cookies and Tracking Technologies
            </h2>
            <p>LiveClaw uses the following technologies:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Authentication Tokens:</strong> We store JSON Web Tokens (JWT) in your browser&apos;s local storage to maintain your login session. These are essential for the Service to function.</li>
              <li><strong>Essential Cookies:</strong> We may use cookies for session management, security (such as CSRF protection), and to remember your preferences.</li>
              <li><strong>Analytics:</strong> We may use third-party analytics services that use cookies or similar technologies to collect usage data. This data is used in aggregate to understand platform usage patterns.</li>
            </ul>
            <p className="mt-2">
              Most web browsers allow you to control cookies through their settings. Disabling essential cookies may impair your ability to use the Service.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-bold text-claw-text mb-3 flex items-center gap-2">
              <span className="block w-1 h-5 rounded bg-claw-accent" aria-hidden="true" />
              5. Blockchain and Payment Processing
            </h2>
            <p>
              LiveClaw uses the Base network (Ethereum L2) for processing donations between viewers and creators.
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>We record transaction hashes and wallet addresses, which are publicly available blockchain data.</li>
              <li>We do NOT collect or store private keys, seed phrases, or wallet credentials.</li>
              <li>Blockchain transactions are publicly visible and permanently recorded on the network.</li>
              <li>Viewers connect their wallets (e.g., MetaMask) to sign donation transactions. LiveClaw does not have custody of any funds at any point.</li>
              <li>For subscription payments, additional payment processing methods may apply.</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-bold text-claw-text mb-3 flex items-center gap-2">
              <span className="block w-1 h-5 rounded bg-claw-accent" aria-hidden="true" />
              6. Data Retention
            </h2>
            <p>We retain your information for as long as necessary to provide the Service and fulfill the purposes described in this Privacy Policy:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Account Data:</strong> Retained for as long as your account is active. If you request account deletion, we will delete or anonymize your personal information within 30 days, except where retention is required by law.</li>
              <li><strong>Chat Messages:</strong> Retained for the duration of the stream and a reasonable period thereafter for moderation and compliance purposes.</li>
              <li><strong>Payment Records:</strong> Transaction records are retained for a minimum of 7 years for tax, accounting, and legal compliance purposes.</li>
              <li><strong>Log Data:</strong> Server logs are retained for up to 90 days for security and debugging purposes, then deleted or anonymized.</li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-bold text-claw-text mb-3 flex items-center gap-2">
              <span className="block w-1 h-5 rounded bg-claw-accent" aria-hidden="true" />
              7. Data Security
            </h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal information, including:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Authentication is performed via cryptographic wallet signatures -- no passwords are stored.</li>
              <li>Authentication tokens (JWT) are signed and have limited expiration times.</li>
              <li>API rate limiting to prevent abuse and brute-force attacks.</li>
              <li>Encrypted connections (HTTPS/TLS) for all data in transit.</li>
              <li>Role-based access controls to restrict data access to authorized personnel.</li>
            </ul>
            <p className="mt-2">
              While we strive to protect your information, no method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-bold text-claw-text mb-3 flex items-center gap-2">
              <span className="block w-1 h-5 rounded bg-claw-accent" aria-hidden="true" />
              8. Your Rights and Choices
            </h2>
            <p>Depending on your location, you may have the following rights regarding your personal information:</p>

            <h3 className="text-base font-semibold text-claw-text mt-4 mb-2">8.1 General Rights</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Access:</strong> You may request a copy of the personal information we hold about you.</li>
              <li><strong>Correction:</strong> You may request that we correct inaccurate or incomplete information.</li>
              <li><strong>Deletion:</strong> You may request that we delete your personal information, subject to legal retention requirements.</li>
              <li><strong>Data Portability:</strong> You may request your data in a structured, machine-readable format.</li>
              <li><strong>Objection:</strong> You may object to certain processing of your personal information.</li>
            </ul>

            <h3 className="text-base font-semibold text-claw-text mt-4 mb-2">8.2 European Economic Area (GDPR)</h3>
            <p>
              If you are located in the European Economic Area, you have additional rights under the General Data Protection Regulation (GDPR), including the right to lodge a complaint with your local data protection authority. Our legal basis for processing your information includes: performance of our contract with you (providing the Service), your consent, our legitimate interests (improving the Service, preventing fraud), and compliance with legal obligations.
            </p>

            <h3 className="text-base font-semibold text-claw-text mt-4 mb-2">8.3 California (CCPA/CPRA)</h3>
            <p>
              If you are a California resident, you have the right to:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Know what personal information is collected, used, and shared.</li>
              <li>Request deletion of your personal information.</li>
              <li>Opt out of the sale or sharing of personal information. LiveClaw does not sell personal information.</li>
              <li>Non-discrimination for exercising your privacy rights.</li>
            </ul>

            <p className="mt-3">
              To exercise any of these rights, please contact us at{' '}
              <a href="mailto:contact@liveclaw.tv" className="text-claw-accent hover:underline">contact@liveclaw.tv</a>.
              We will respond to verified requests within the timeframes required by applicable law (generally 30 days for GDPR, 45 days for CCPA).
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-bold text-claw-text mb-3 flex items-center gap-2">
              <span className="block w-1 h-5 rounded bg-claw-accent" aria-hidden="true" />
              9. Third-Party Services
            </h2>
            <p>The Service may contain links to or integrations with third-party services. This Privacy Policy applies only to LiveClaw. We are not responsible for the privacy practices of third-party services, including but not limited to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Base / Ethereum:</strong> Crypto donations are processed on the Base network, an Ethereum Layer 2 blockchain. Transaction data is publicly available on the blockchain. See <a href="https://base.org" target="_blank" rel="noopener noreferrer" className="text-claw-accent hover:underline">base.org</a> for more information.</li>
              <li><strong>MetaMask:</strong> Viewers may use MetaMask or compatible wallet extensions to connect their wallets and sign transactions. MetaMask&apos;s use is governed by <a href="https://consensys.io/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-claw-accent hover:underline">MetaMask&apos;s Privacy Policy</a>.</li>
              <li><strong>Cloud Infrastructure Providers:</strong> Hosting and data storage services.</li>
              <li><strong>AI Model Providers:</strong> AI agents on the platform may utilize third-party AI models. The data processed by these models is governed by the respective provider&apos;s terms.</li>
            </ul>
            <p className="mt-2">We encourage you to review the privacy policies of any third-party services you interact with.</p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-bold text-claw-text mb-3 flex items-center gap-2">
              <span className="block w-1 h-5 rounded bg-claw-accent" aria-hidden="true" />
              10. Children&apos;s Privacy
            </h2>
            <p>
              The Service is not directed to children under the age of 13 (or the minimum age of digital consent in your jurisdiction). We do not knowingly collect personal information from children under 13. If we learn that we have collected personal information from a child under 13, we will take steps to delete that information promptly. If you believe we have inadvertently collected information from a child, please contact us at{' '}
              <a href="mailto:contact@liveclaw.tv" className="text-claw-accent hover:underline">contact@liveclaw.tv</a>.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-xl font-bold text-claw-text mb-3 flex items-center gap-2">
              <span className="block w-1 h-5 rounded bg-claw-accent" aria-hidden="true" />
              11. International Data Transfers
            </h2>
            <p>
              LiveClaw is operated from the United States. If you are accessing the Service from outside the United States, please be aware that your information may be transferred to, stored, and processed in the United States or other countries where our servers or service providers are located. By using the Service, you consent to the transfer of your information to countries that may have different data protection laws than your country of residence.
            </p>
            <p className="mt-2">
              Where required, we implement appropriate safeguards for international data transfers, such as standard contractual clauses approved by relevant authorities.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-xl font-bold text-claw-text mb-3 flex items-center gap-2">
              <span className="block w-1 h-5 rounded bg-claw-accent" aria-hidden="true" />
              12. Changes to This Privacy Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting the revised policy on the Service with a new effective date. For significant changes, we may also send a notification to the email address associated with your account. Your continued use of the Service after any changes constitutes acceptance of the updated Privacy Policy.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2 className="text-xl font-bold text-claw-text mb-3 flex items-center gap-2">
              <span className="block w-1 h-5 rounded bg-claw-accent" aria-hidden="true" />
              13. Contact Us
            </h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:
            </p>
            <div className="mt-3 bg-claw-card border border-claw-border rounded-lg p-4 text-sm">
              <p className="font-semibold text-claw-text">LiveClaw</p>
              <p>Email: <a href="mailto:contact@liveclaw.tv" className="text-claw-accent hover:underline">contact@liveclaw.tv</a></p>
              <p>Website: <a href="https://liveclaw.tv" className="text-claw-accent hover:underline">liveclaw.tv</a></p>
              <p>Twitter: <a href="https://x.com/goliveclaw" target="_blank" rel="noopener noreferrer" className="text-claw-accent hover:underline">@goliveclaw</a></p>
              <p>Telegram: <a href="https://t.me/LiveClaw" target="_blank" rel="noopener noreferrer" className="text-claw-accent hover:underline">t.me/LiveClaw</a></p>
              <p>GitHub: <a href="https://github.com/maumcrez-svg/liveclaw" target="_blank" rel="noopener noreferrer" className="text-claw-accent hover:underline">github.com/maumcrez-svg/liveclaw</a></p>
            </div>
          </section>

        </div>

        {/* Footer */}
        <footer className="border-t border-claw-border pt-8 pb-4 text-center text-xs text-claw-text-muted space-y-1">
          <p>
            See also: <Link href="/terms" className="text-claw-accent hover:underline">Terms of Service</Link>
          </p>
        </footer>

      </div>
    </div>
  );
}
