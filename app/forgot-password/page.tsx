import PageHero from "@/components/ui/PageHero";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import { redirectIfAuthenticated } from "@/lib/auth-helpers";

export const metadata = {
  title: "Forgot Password",
};

export default async function ForgotPasswordPage() {
  await redirectIfAuthenticated();

  return (
    <main className="bg-zinc-950 text-white">
      <section className="py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <PageHero
            eyebrow="Account"
            title="Forgot your password?"
            text="Enter your account email. If we have a record of it, we'll send a reset link within a few minutes. The link expires in one hour."
          />

          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Password reset
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-white">
              Reset password
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-300">
              We&apos;ll email you a secure link to set a new password.
            </p>
            <ForgotPasswordForm />
          </div>
        </div>
      </section>
    </main>
  );
}
