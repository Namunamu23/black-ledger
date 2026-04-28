import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms governing your use of Black Ledger and the purchase of digital case files.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <article className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <header className="mb-12 border-b border-zinc-800 pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Legal
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">
            Terms of Service
          </h1>
          <p className="mt-4 text-sm text-zinc-400">
            Last updated: April 28, 2026
          </p>
        </header>

        <div className="space-y-10 text-sm leading-7 text-zinc-300">
          <section>
            <p>
              These Terms of Service (&quot;Terms&quot;) govern your access
              to and use of the website at{" "}
              <Link
                href="/"
                className="text-amber-400 underline hover:text-amber-300"
              >
                theblackledger.app
              </Link>{" "}
              and the digital case files, activation codes, and related
              services made available through it (the &quot;Service&quot;).
            </p>
            <p className="mt-4">
              The Service is provided by Demetre Gatchava
              (დემეტრე ღაჭავა), an individual based in Georgia
              (&quot;Black Ledger,&quot; &quot;we,&quot; &quot;us,&quot;
              or &quot;our&quot;).
            </p>
            <p className="mt-4">
              By creating an account, purchasing a case file, or otherwise
              using the Service, you agree to be bound by these Terms. If
              you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              1. The Service
            </h2>
            <p>
              Black Ledger is a digital entertainment product. We sell
              fictional investigation case files: each purchase grants you
              an activation code that unlocks a digital case file inside
              your bureau account. The cases, characters, evidence, and
              storylines are entirely fictional and are intended solely for
              entertainment. Nothing in the Service represents real persons,
              real events, real investigations, or actual legal advice.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              2. Eligibility
            </h2>
            <p className="mb-4">By using the Service, you represent that:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                you are at least 18 years old (or the legal age of majority
                in your jurisdiction, whichever is higher) to make a
                purchase;
              </li>
              <li>
                you are at least 16 years old to register an account and
                use any portion of the Service;
              </li>
              <li>
                you have the legal capacity to enter into these Terms;
              </li>
              <li>
                you are not prohibited from using the Service under the laws
                of your jurisdiction.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              3. Account Registration
            </h2>
            <p>
              To access purchased case files you must create an account
              with a valid email address and a password. You are
              responsible for keeping your account credentials secure and
              for any activity that occurs under your account. Notify us
              immediately at{" "}
              <a
                href="mailto:support@theblackledger.app"
                className="text-amber-400 underline hover:text-amber-300"
              >
                support@theblackledger.app
              </a>{" "}
              if you suspect unauthorized access.
            </p>
            <p className="mt-3">
              You may close your account at any time by contacting us. We
              may suspend or terminate accounts that violate these Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              4. Purchases and Payment
            </h2>
            <p>
              All purchases are processed by Stripe. The price for each
              case file is displayed at checkout. By completing a purchase
              you authorize us, through Stripe, to charge the payment
              method you provide.
            </p>
            <p className="mt-3">
              After successful payment, an activation code will be
              delivered to the email address you provided at checkout.
              Activation codes are intended for the purchasing customer
              only.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              5. License Grant
            </h2>
            <p>
              When you purchase a case file and redeem its activation code,
              we grant you a limited, non-exclusive, non-transferable,
              non-sublicensable license to access and play through that
              case file inside your bureau account, for personal,
              non-commercial entertainment use. You may not:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                share, resell, redistribute, or transfer your activation
                code or case access to anyone else;
              </li>
              <li>
                copy, scrape, mirror, or download bulk content from the
                Service;
              </li>
              <li>
                use the Service or its content for commercial purposes,
                including but not limited to live events, streamed
                play-throughs as paid content, or derivative works for
                sale, without our prior written permission;
              </li>
              <li>
                attempt to bypass authentication, paywalls, rate limits,
                or other protective measures;
              </li>
              <li>
                reverse-engineer, decompile, or otherwise attempt to
                extract source code or game logic.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              6. Activation Codes
            </h2>
            <p>
              Each activation code is single-use and is bound to the first
              account that redeems it. Sharing an activation code, posting
              it publicly, or attempting to use a code that does not
              belong to you violates these Terms and may result in
              immediate termination of your account without refund.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              7. Refund Policy
            </h2>
            <p className="mb-4">
              Because Black Ledger sells digital products, our refund
              policy is:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                You may request a full refund within{" "}
                <strong className="text-white">7 days</strong> of purchase{" "}
                <strong className="text-white">
                  if you have not redeemed the activation code
                </strong>
                . Once an activation code is redeemed against an account,
                the case file is considered delivered and the sale is final.
              </li>
              <li>
                To request a refund, email{" "}
                <a
                  href="mailto:support@theblackledger.app"
                  className="text-amber-400 underline hover:text-amber-300"
                >
                  support@theblackledger.app
                </a>{" "}
                with your purchase email and the order or session reference.
                We will verify the unredeemed status of the activation
                code and process the refund through Stripe to the original
                payment method.
              </li>
              <li>
                Outside of the 7-day window, or once the activation code
                has been redeemed, refunds are at our sole discretion and
                are typically not granted.
              </li>
              <li>
                If a transaction is determined to be fraudulent, we may
                refund and revoke the activation code at any time.
              </li>
            </ul>
            <p className="mt-4">
              Statutory consumer rights, where applicable, are not affected
              by this policy.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              8. Intellectual Property
            </h2>
            <p>
              All content made available through the Service — including
              case files, narratives, characters, evidence text, hints,
              checkpoints, designs, code, branding, and the Black Ledger
              name and logo — is owned by Demetre Gatchava or licensed to
              us. We retain all rights not expressly granted to you in
              these Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              9. User Submissions
            </h2>
            <p>
              When you submit content through the Service — such as theory
              submissions, checkpoint answers, or support messages — you
              grant us a worldwide, royalty-free license to store, process,
              and use that content as necessary to operate the Service. You
              represent that any content you submit is yours to share and
              does not infringe any third party&apos;s rights.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              10. Acceptable Use
            </h2>
            <p className="mb-4">You agree not to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>use the Service for any unlawful purpose;</li>
              <li>
                upload or transmit malicious code, viruses, or harmful
                automation;
              </li>
              <li>
                impersonate another person or misrepresent your affiliation;
              </li>
              <li>
                interfere with or disrupt the integrity, security, or
                performance of the Service;
              </li>
              <li>
                use any automated means to access the Service except via
                officially documented APIs (we have none currently);
              </li>
              <li>
                harass, threaten, or send abusive content through any of our
                forms or channels.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              11. Disclaimers
            </h2>
            <p>
              The Service is provided &quot;as is&quot; and &quot;as
              available,&quot; without warranties of any kind, whether
              express or implied, including but not limited to implied
              warranties of merchantability, fitness for a particular
              purpose, and non-infringement. We do not warrant that the
              Service will be uninterrupted, error-free, or completely
              secure.
            </p>
            <p className="mt-3">
              Black Ledger is a fictional entertainment product. It does not
              represent real police investigations, real persons, real
              events, or real legal procedures. Nothing in the Service
              constitutes legal, medical, financial, or other professional
              advice.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              12. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by applicable law, in no
              event shall Demetre Gatchava be liable for any indirect,
              incidental, special, consequential, or punitive damages,
              including but not limited to lost profits, lost data, or
              business interruption, arising out of or related to your use
              of the Service.
            </p>
            <p className="mt-3">
              Our total cumulative liability for any claim arising out of
              or related to the Service shall not exceed the amount you
              paid to us during the twelve (12) months preceding the event
              giving rise to the claim, or one hundred United States
              dollars (USD 100), whichever is greater.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              13. Indemnification
            </h2>
            <p>
              You agree to defend, indemnify, and hold harmless Demetre
              Gatchava from and against any claims, liabilities, damages,
              losses, and expenses (including reasonable legal fees)
              arising out of or in any way connected with your breach of
              these Terms, your misuse of the Service, or your violation of
              any law or third-party right.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              14. Termination
            </h2>
            <p>
              We may suspend or terminate your access to the Service at
              any time, with or without cause and with or without notice,
              if we believe you have violated these Terms or applicable
              law. Sections that by their nature should survive termination
              (Intellectual Property, Disclaimers, Limitation of Liability,
              Indemnification, Governing Law) will survive.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              15. Governing Law and Jurisdiction
            </h2>
            <p>
              These Terms are governed by the laws of Georgia, without
              regard to its conflict-of-laws principles. Any dispute
              arising out of or related to these Terms or the Service
              shall be resolved exclusively in the courts of Tbilisi,
              Georgia.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              16. Changes to These Terms
            </h2>
            <p>
              We may update these Terms from time to time. When we make
              material changes, we will update the &quot;Last updated&quot;
              date at the top of this page and, where appropriate, notify
              you by email. Your continued use of the Service after the
              effective date of the updated Terms constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">
              17. Contact
            </h2>
            <p>For questions about these Terms, contact:</p>
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
