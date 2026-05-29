"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { getCurrentUser } from "@/lib/auth";
import { useAuth } from "@/components/auth/auth-context";
import { getErrorMessage } from "@/lib/forms/error-message";

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
        router.replace("/predictions");
      }
      router.refresh();
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "Unable to sign in. Please try again."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Email</span>
          <input
            autoComplete="email"
            name="email"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Password</span>
          <input
            autoComplete="current-password"
            minLength={1}
            name="password"
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        {errorMessage ? (
          <p
            aria-live="polite"
            className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
          >
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-sm text-zinc-600">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-emerald-700">
          Create an account
        </Link>
      </p>
    </>
  );
}
