import { Suspense } from "react";
import PageHero from "@/components/ui/PageHero";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata = {
  title: "Reset Password",
};

export default function ResetPasswordPage() {
  return (
    <main className="bg-zinc-950 text-white">
      <section className="py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <PageHero
            eyebrow="Account"
            title="Set a new password"
            text="Choose a strong password for your Black Ledger operative account. The reset link is valid for one hour."
          />

          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Password reset
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-white">
              New password
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-300">
              Enter and confirm your new password below.
            </p>

            {/* Suspense boundary required — ResetPasswordForm reads useSearchParams */}
            <Suspense fallback={null}>
              <ResetPasswordForm />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}
