import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
      <section className="rounded-md border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
          Sign up
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-zinc-950">
          Create your predictor profile
        </h1>
        <SignupForm />
      </section>

      {/* <aside className="rounded-md border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-950">
          Predictor profile
        </h2>
        <dl className="mt-6 space-y-5 text-sm">
          <div>
            <dt className="font-medium text-zinc-950">Role</dt>
            <dd className="mt-1 text-zinc-600">Normal user</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-950">Access</dt>
            <dd className="mt-1 text-zinc-600">
              Predictions, leaderboard, groups, brackets, charts, and rules.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-950">Scoring</dt>
            <dd className="mt-1 text-zinc-600">
              Exact scores, goal difference, game duration, cards, and opening team.
            </dd>
          </div>
        </dl>
      </aside> */}
    </main>
  );
}
