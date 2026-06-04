import { ChangePasswordForm } from "@/components/auth/change-password-form";

const ChangePasswordPage = () => {
  return (
    <main className="flex flex-1 w-full">
      <section className="hidden lg:block lg:w-[55%] xl:w-[67%] bg-[url('/images/login-bg.jpg')] bg-cover"></section>
      <section className="w-full lg:w-[45%] xl:w-[33%] bg-white p-6 dark:bg-zinc-900 sm:p-8">
        <div className="flex flex-col gap-2 items-center text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
            Security
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-3xl">
            Change password
          </h1>
        </div>
        <ChangePasswordForm />
      </section>
    </main>
  );
};

export default ChangePasswordPage;
