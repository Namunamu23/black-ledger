import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Black Ledger collects, uses, and protects the information you share when using the service.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <article className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <header className="mb-12 border-b border-zinc-800 pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Legal
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm text-zinc-400">
            Last updated: April 28, 2026
          </p>
        </header>

        <div className="space-y-10 text-sm leading-7 text-zinc-300">
          <section>
            <p>
              This Privacy Policy explains how Demetre Gatchava
              (&quot;Black Ledger,&quot; &quot;we,&quot; &quot;us,&quot;
              or &quot;our&quot;), an individual operating from Georgia,
              collects, uses, and protects information when you use the
              website at{" "}
              <Link
                href="/"
                className="text-amber-400 underline hover:text-amber-300"
              >
                theblackledger.app
              </Link>{" "}
              and the services made available through it (the
              &quot;Service&quot;).
            </p>
            <p className="mt-4">
              By using the Service, you agree to the collection and use of
              information as described in this policy. If you do not agree,
              please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              1. Who We Are
            </h2>
            <p>
              Demetre Gatchava (დემეტრე ღაჭავა), an individual based in
              Georgia, is the operator and data controller responsible for
              the personal data processed through the Service.
            </p>
            <p className="mt-3">
              Contact for privacy-related inquiries:{" "}
              <a
                href="mailto:support@theblackledger.app"
                className="text-amber-400 underline hover:text-amber-300"
              >
                support@theblackledger.app
              </a>
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              2. Information We Collect
            </h2>
            <p className="mb-4">
              We collect only what we need to provide the Service. Specifically:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong className="text-white">Account information:</strong>{" "}
                your email address, optional display name, and a hashed
                version of your password (we never store passwords in
                plain text).
              </li>
              <li>
                <strong className="text-white">Authentication state:</strong>{" "}
                a session cookie (issued by NextAuth) that keeps you signed
                in. This cookie contains a signed identifier and your
                session version number; it does not contain your password
                or any personal data.
              </li>
              <li>
                <strong className="text-white">Purchase information:</strong>{" "}
                the email address you provide at checkout, the case file
                you purchase, and Stripe payment metadata such as the
                checkout session ID and payment intent. We do{" "}
                <strong>not</strong> store your card number, expiration
                date, or CVV — those are handled entirely by Stripe.
              </li>
              <li>
                <strong className="text-white">Activity and security data:</strong>{" "}
                IP address (used for rate limiting and abuse prevention),
                browser user-agent, server access logs, theory submissions
                you make, checkpoint attempts, support messages you send,
                and timestamps of activations and case progress.
              </li>
              <li>
                <strong className="text-white">Optional content:</strong>{" "}
                anything you voluntarily submit in support messages, theory
                submissions, or other forms.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              3. How We Use Your Information
            </h2>
            <p className="mb-4">We use this information to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>create and maintain your account;</li>
              <li>
                deliver the Service you have purchased, including sending
                activation codes by email and granting access to case files;
              </li>
              <li>
                process payments through Stripe and prevent fraudulent
                transactions;
              </li>
              <li>
                operate the Service securely, including rate limiting,
                detecting abuse, and protecting against automated attacks;
              </li>
              <li>
                respond to your support requests and provide customer
                service;
              </li>
              <li>
                send you transactional emails (purchase confirmations,
                password resets, support replies) — we do not send marketing
                emails;
              </li>
              <li>
                comply with legal obligations under Georgian law, including
                tax and accounting requirements.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              4. Legal Basis for Processing
            </h2>
            <p className="mb-4">
              Our legal bases under Georgia&apos;s Law on Personal Data
              Protection (and equivalent international frameworks) are:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong className="text-white">Contract performance:</strong>{" "}
                processing necessary to provide the Service you purchased
                and to manage your account.
              </li>
              <li>
                <strong className="text-white">Legitimate interests:</strong>{" "}
                security, fraud prevention, and protecting the integrity of
                the Service.
              </li>
              <li>
                <strong className="text-white">Legal obligation:</strong>{" "}
                retention of financial records as required by tax and
                accounting law.
              </li>
              <li>
                <strong className="text-white">Consent:</strong>{" "}
                where you have explicitly agreed (for example, when
                submitting a support form).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              5. Third-Party Service Providers
            </h2>
            <p className="mb-4">
              We rely on the following processors to operate the Service.
              Each is contractually bound by their own privacy obligations
              and applicable data protection laws:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong className="text-white">Stripe</strong> (United
                States) — payment processing.{" "}
                <a
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 underline hover:text-amber-300"
                >
                  stripe.com/privacy
                </a>
              </li>
              <li>
                <strong className="text-white">Resend</strong> (United
                States) — transactional email delivery.{" "}
                <a
                  href="https://resend.com/legal/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 underline hover:text-amber-300"
                >
                  resend.com/legal/privacy-policy
                </a>
              </li>
              <li>
                <strong className="text-white">Vercel</strong> (United
                States) — application hosting.{" "}
                <a
                  href="https://vercel.com/legal/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 underline hover:text-amber-300"
                >
                  vercel.com/legal/privacy-policy
                </a>
              </li>
              <li>
                <strong className="text-white">Neon</strong> (United States)
                — managed PostgreSQL database.{" "}
                <a
                  href="https://neon.tech/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 underline hover:text-amber-300"
                >
                  neon.tech/privacy-policy
                </a>
              </li>
              <li>
                <strong className="text-white">Cloudflare R2</strong> (United
                States) — image storage.{" "}
                <a
                  href="https://www.cloudflare.com/privacypolicy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 underline hover:text-amber-300"
                >
                  cloudflare.com/privacypolicy
                </a>
              </li>
              <li>
                <strong className="text-white">Upstash</strong> (United
                States) — Redis-based rate limiting.{" "}
                <a
                  href="https://upstash.com/trust/privacy.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 underline hover:text-amber-300"
                >
                  upstash.com/trust/privacy
                </a>
              </li>
            </ul>
            <p className="mt-4">
              We do not sell your personal information. We do not share it
              with third parties except as necessary to operate the Service
              or as required by law.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              6. International Data Transfers
            </h2>
            <p>
              Because all of our processors listed above are based in the
              United States, your personal data is transferred outside of
              Georgia in the course of normal Service operation. The legal
              basis for these transfers is contract necessity (you cannot
              receive the Service without the data reaching our processors)
              and, where applicable, your consent. Each processor maintains
              their own safeguards and certifications for international
              data handling.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              7. Cookies
            </h2>
            <p>
              We use a single functional cookie issued by NextAuth to keep
              you signed in across pages. This cookie is essential to the
              operation of the Service. We do not use analytics cookies,
              advertising cookies, or third-party tracking cookies. You can
              clear or block this cookie in your browser settings, but doing
              so will prevent you from signing in.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              8. Data Retention
            </h2>
            <p className="mb-4">We retain personal data for as long as:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                your account is active (account data, owned cases, theory
                submissions, support history);
              </li>
              <li>
                required by Georgian tax and accounting law (financial
                records, typically 6 years from the end of the relevant tax
                period);
              </li>
              <li>necessary to comply with other legal obligations.</li>
            </ul>
            <p className="mt-4">
              When you request account deletion, we will delete all
              personal data we hold about you, except where retention is
              required by law.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              9. Your Rights
            </h2>
            <p className="mb-4">
              Under Georgia&apos;s Law on Personal Data Protection (and
              equivalent international frameworks), you have the right to:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                access the personal data we hold about you;
              </li>
              <li>correct inaccurate data;</li>
              <li>
                request deletion of your data (subject to legal retention
                requirements);
              </li>
              <li>
                receive a copy of your data in a machine-readable format
                (data portability);
              </li>
              <li>object to or restrict certain processing;</li>
              <li>withdraw any consent you have given us;</li>
              <li>
                lodge a complaint with the Personal Data Protection Service
                of Georgia (or your local supervisory authority if outside
                Georgia).
              </li>
            </ul>
            <p className="mt-4">
              To exercise any of these rights, email{" "}
              <a
                href="mailto:support@theblackledger.app"
                className="text-amber-400 underline hover:text-amber-300"
              >
                support@theblackledger.app
              </a>
              . We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              10. Children
            </h2>
            <p>
              The Service is not directed at, and we do not knowingly
              collect personal data from, individuals under the age of 16.
              If you believe a child has provided us with personal data,
              contact{" "}
              <a
                href="mailto:support@theblackledger.app"
                className="text-amber-400 underline hover:text-amber-300"
              >
                support@theblackledger.app
              </a>{" "}
              and we will delete it.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              11. Security
            </h2>
            <p>
              We use industry-standard practices to protect your data:
              passwords are hashed with bcrypt (cost factor 12), session
              tokens are signed and time-bounded, all traffic is served
              over HTTPS, and we apply rate limiting and security headers to
              protect against common attacks. No system is perfectly secure,
              but we work hard to minimize risk.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              12. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. When we
              make material changes, we will update the &quot;Last
              updated&quot; date at the top of this page and, where
              appropriate, notify you by email. Your continued use of the
              Service after changes take effect constitutes acceptance of
              the updated policy.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              13. Contact
            </h2>
            <p>
              For any privacy-related question, request, or concern, contact:
            </p>
            <p className="mt-3 font-mono text-zinc-200">
              Demetre Gatchava
              <br />
              <a
                href="mailto:support@theblackledger.app"
                className="text-amber-400 underline hover:text-amber-300"
              >
                support@theblackledger.app
              </a>
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
