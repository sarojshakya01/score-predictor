"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { verifyEmail } from "@/lib/auth";
import { getErrorMessage } from "@/lib/forms/error-message";
import { IconShieldCheck } from "@/components/ui/icons";

export const VerifyEmailPanel = ({ token }: { token: string | null }) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(Boolean(token));
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const verify = async () => {
      if (!token) {
        setErrorMessage("Verification token is missing.");
        setIsVerifying(false);
        return;
      }

      try {
        const response = await verifyEmail({ token });
        if (isMounted) {
          setSuccessMessage(response.message);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            getErrorMessage(error, "Unable to verify your email."),
          );
        }
      } finally {
        if (isMounted) {
          setIsVerifying(false);
        }
      }
    };

    void verify();

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <div className="mt-8 space-y-5">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        <IconShieldCheck className="h-7 w-7" />
      </div>

      {isVerifying ? (
        <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-center text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          Verifying your email...
        </p>
      ) : null}

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

      <Link
        href="/login"
        className="inline-flex h-11 w-full items-center justify-center rounded-md bg-tournament-primary px-4 text-sm font-semibold text-white transition hover:bg-tournament-primary"
      >
        Go to login
      </Link>
    </div>
  );
};
