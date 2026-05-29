import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
      <section className="rounded-md border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
          Login
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-zinc-950">
          Welcome back
        </h1>
        <LoginForm />
      </section>

      <section className="football-field hidden min-h-[420px] rounded-md border border-emerald-900/20 p-8 text-white shadow-sm lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-50">
            Match day access
          </p>
          <h2 className="mt-4 max-w-md text-4xl font-semibold tracking-normal">
            Predict every fixture and climb the leaderboard.
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-md bg-white/15 p-3">
            <p className="text-2xl font-semibold">15</p>
            <p className="mt-1 text-emerald-50">Exact score</p>
          </div>
          <div className="rounded-md bg-white/15 p-3">
            <p className="text-2xl font-semibold">5</p>
            <p className="mt-1 text-emerald-50">Duration</p>
          </div>
          <div className="rounded-md bg-white/15 p-3">
            <p className="text-2xl font-semibold">3</p>
            <p className="mt-1 text-emerald-50">Opening team</p>
          </div>
        </div>
      </section>
    </main>
  );
}
