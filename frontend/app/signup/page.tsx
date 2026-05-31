import { SignupForm } from "@/components/auth/signup-form";

const SignupPage = () => {
  return (
    <main className="flex items-center justify-center bg-[url('/images/login-bg.webp')] bg-cover bg-center w-full min-w-full mx-auto max-w-6xl flex-1 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-1 lg:px-8">
      <section className="flex items-center justify-center rounded-md w-1/2 max-h-max border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex flex-col gap-6 items-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
            Sign up
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
            Create your predictor profile
          </h1>
          <SignupForm />
        </div>
      </section>
    </main>
  );
};

export default SignupPage;
