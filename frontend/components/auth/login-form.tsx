"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { getCurrentUser } from "@/lib/auth";
import { useAuth } from "@/components/auth/auth-context";
import { getErrorMessage } from "@/lib/forms/error-message";
import { IconLogin } from "@/components/ui/icons";

const inputCls = "mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-tournament-primary focus:ring-2 focus:ring-emerald-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-emerald-900";

export const LoginForm = () => {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await login({
        email: email.trim().toLowerCase(),
        password,
      });
      const currentUser = await getCurrentUser();
      if (currentUser.role === "ADMIN") {
        router.replace("/admin");
      } else {
        router.replace("/");
      }
      router.refresh();
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "Unable to log in. Please try again."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</span>
          <input
            autoComplete="email"
            name="email"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</span>
          <input
            autoComplete="current-password"
            minLength={1}
            name="password"
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputCls}
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <Link href="/forgot-password" className="font-semibold text-emerald-700 dark:text-emerald-400">
            Forgot password?
          </Link>
        </div>

        {errorMessage ? (
          <p aria-live="polite" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300">
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-11 w-full items-center cursor-pointer justify-center gap-2 rounded-md bg-tournament-primary px-4 text-sm font-semibold text-white transition hover:bg-tournament-primary disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {isSubmitting ? "Signing in..." : (<><IconLogin className="h-4 w-4" />Log in</>)}
        </button>
      </form>
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-emerald-700 dark:text-emerald-400">
          Create an account
        </Link>
      </p>
    </>
  );
}
