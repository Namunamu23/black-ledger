import { requireSession } from "@/lib/auth-helpers";
import DeleteAccountForm from "@/components/auth/DeleteAccountForm";
import { Card } from "@/components/ui";

export const metadata = {
  title: "Delete Account",
  description: "Permanently delete your Black Ledger account.",
};

export default async function DeleteAccountPage() {
  await requireSession();

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-xl px-6 py-16 sm:py-24">
        <Card variant="dossier" padding="lg">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-400">
            Danger Zone
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white">
            Delete your account
          </h1>
          <p className="mt-4 text-sm leading-7 text-zinc-300">
            This permanently deletes your Black Ledger account, all of your
            owned cases, theory submissions, and checkpoint attempts. Your
            purchase records (Order history) are retained for tax and
            accounting purposes per our Privacy Policy &sect;8. Activation
            codes you have redeemed will be unowned and cannot be re-used.
          </p>
          <p className="mt-4 text-sm leading-7 text-zinc-300">
            This action cannot be undone. You will be signed out immediately.
          </p>
          <div className="mt-8">
            <DeleteAccountForm />
          </div>
        </Card>
      </div>
    </main>
  );
}
