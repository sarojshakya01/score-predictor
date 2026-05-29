"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { signup } from "@/lib/auth";
import { getErrorMessage } from "@/lib/forms/error-message";

type SignupFormState = {
  email: string;
  firstName: string;
  lastName: string;
  middleName: string;
  mobileNo: string;
  password: string;
};

const initialState: SignupFormState = {
  email: "",
  firstName: "",
  lastName: "",
  middleName: "",
  mobileNo: "",
  password: "",
};

export function SignupForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<SignupFormState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: keyof SignupFormState, value: string) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await signup({
        email: formState.email.trim().toLowerCase(),
        first_name: formState.firstName.trim(),
        last_name: formState.lastName.trim(),
        middle_name: formState.middleName.trim() || null,
        mobile_no: formState.mobileNo.trim(),
        password: formState.password,
      });
      router.replace("/predictions");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "Unable to create your account. Please try again."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form className="mt-8 grid gap-5 sm:grid-cols-2" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">First name</span>
          <input
            autoComplete="given-name"
            name="first_name"
            required
            type="text"
            value={formState.firstName}
            onChange={(event) => updateField("firstName", event.target.value)}
            className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Last name</span>
          <input
            autoComplete="family-name"
            name="last_name"
            required
            type="text"
            value={formState.lastName}
            onChange={(event) => updateField("lastName", event.target.value)}
            className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Middle name</span>
          <input
            autoComplete="additional-name"
            name="middle_name"
            type="text"
            value={formState.middleName}
            onChange={(event) => updateField("middleName", event.target.value)}
            className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Mobile number</span>
          <input
            autoComplete="tel"
            name="mobile_no"
            required
            type="tel"
            value={formState.mobileNo}
            onChange={(event) => updateField("mobileNo", event.target.value)}
            className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-zinc-700">Email</span>
          <input
            autoComplete="email"
            name="email"
            required
            type="email"
            value={formState.email}
            onChange={(event) => updateField("email", event.target.value)}
            className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-zinc-700">Password</span>
          <input
            autoComplete="new-password"
            minLength={8}
            name="password"
            required
            type="password"
            value={formState.password}
            onChange={(event) => updateField("password", event.target.value)}
            className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        {errorMessage ? (
          <p
            aria-live="polite"
            className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 sm:col-span-2"
          >
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:col-span-2"
        >
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-sm text-zinc-600">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-emerald-700">
          Sign in
        </Link>
      </p>
    </>
  );
}
