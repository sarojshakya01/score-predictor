"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { resendVerification } from "@/lib/auth";
import { getErrorMessage } from "@/lib/forms/error-message";
import { IconMail } from "@/components/ui/icons";

const inputCls = "mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-tournament-primary focus:ring-2 focus:ring-emerald-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-emerald-900";

export const ResendVerificationForm = () => {
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await resendVerification({
        email: email.trim().toLowerCase(),
      });
      setSuccessMessage(response.message);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "Unable to send verification email."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
          </span>
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

        {successMessage ? (
          <p aria-live="polite" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            {successMessage}
          </p>
        ) : null}

        {errorMessage ? (
          <p aria-live="polite" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300">
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-tournament-primary px-4 text-sm font-semibold text-white transition hover:bg-tournament-primary disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {isSubmitting ? "Sending verification..." : (<><IconMail className="h-4 w-4" />Send verification</>)}
        </button>
      </form>
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Back to{" "}
        <Link href="/login" className="font-semibold text-emerald-700 dark:text-emerald-400">
          login
        </Link>
      </p>
    </>
  );
};
