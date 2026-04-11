export default function LoginPage() {
  return (
    <main className="bg-zinc-950 text-white">
      <section className="py-20">
        <div className="mx-auto max-w-md px-6">
          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Login
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-white">
              Access the bureau
            </h1>
            <p className="mt-4 text-sm leading-7 text-zinc-300">
              Account access and protected case portal features will be connected in a later phase.
            </p>

            <div className="mt-8 grid gap-4">
              <input
                type="email"
                placeholder="Email"
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
              />
              <input
                type="password"
                placeholder="Password"
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
              />
              <button className="rounded-2xl bg-amber-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300">
                Log In
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}