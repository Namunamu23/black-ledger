export default function LoginPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-md px-6 py-24">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Login
          </div>
          <h1 className="mt-4 text-3xl font-semibold">Access the bureau</h1>

          <div className="mt-8 grid gap-4">
            <input
              type="email"
              placeholder="Email"
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            />
            <input
              type="password"
              placeholder="Password"
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            />
            <button className="rounded-xl bg-amber-400 px-4 py-3 font-semibold text-zinc-950">
              Log In
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}