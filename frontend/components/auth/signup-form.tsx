"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { signup } from "@/lib/auth";
import { getErrorMessage } from "@/lib/forms/error-message";
import { IconUserPlus } from "@/components/ui/icons";

const inputCls = "mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-tournament-primary focus:ring-2 focus:ring-emerald-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-emerald-900";
const labelCls = "text-sm font-medium text-zinc-700 dark:text-zinc-300";

type SignupFormState = {
  confirmPassword: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName: string;
  mobileNo: string;
  password: string;
};

const initialState: SignupFormState = {
  confirmPassword: "",
  email: "",
  firstName: "",
  lastName: "",
  middleName: "",
  mobileNo: "",
  password: "",
};

export const SignupForm = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<SignupFormState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const updateField = (field: keyof SignupFormState, value: string) => {
    setFormState((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (formState.password !== formState.confirmPassword) {
        setErrorMessage("Passwords do not match.");
        setIsSubmitting(false);
        return;
      }

      const newUser = await signup({
        email: formState.email.trim().toLowerCase(),
        first_name: formState.firstName.trim(),
        last_name: formState.lastName.trim(),
        middle_name: formState.middleName.trim() || null,
        mobile_no: formState.mobileNo.trim(),
        password: formState.password,
      });
      setFormState(initialState);
      setSuccessMessage(newUser.message || "Account created successfully.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to create your account. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMatchPassword = (value: string) => {
    if (value && formState.password.length && value !== formState.password) {
      setErrorMessage("Passwords do not match.");
    } else {
      setErrorMessage(null);
    }
  };

  return (
    <>
      <form className="mt-8 grid gap-5 sm:grid-cols-6" onSubmit={handleSubmit}>
        <label className="block col-span-2">
          <span className={labelCls}>First name</span>
          <input autoComplete="given-name" name="first_name" required type="text" value={formState.firstName} onChange={(e) => updateField("firstName", e.target.value)} className={inputCls} />
        </label>
        <label className="block col-span-2">
          <span className={labelCls}>Middle name</span>
          <input autoComplete="additional-name" name="middle_name" type="text" value={formState.middleName} onChange={(e) => updateField("middleName", e.target.value)} className={inputCls} />
        </label>
        <label className="block col-span-2">
          <span className={labelCls}>Last name</span>
          <input autoComplete="family-name" name="last_name" required type="text" value={formState.lastName} onChange={(e) => updateField("lastName", e.target.value)} className={inputCls} />
        </label>
        <label className="block col-span-3">
          <span className={labelCls}>Mobile number</span>
          <input autoComplete="tel" name="mobile_no" required type="tel" value={formState.mobileNo} onChange={(e) => updateField("mobileNo", e.target.value)} className={inputCls} />
        </label>
        <label className="block col-span-3">
          <span className={labelCls}>Email</span>
          <input autoComplete="email" name="email" required type="email" value={formState.email} onChange={(e) => updateField("email", e.target.value)} className={inputCls} />
        </label>
        <label className="block col-span-3">
          <span className={labelCls}>Password</span>
          <input autoComplete="new-password" minLength={8} name="password" required type="password" value={formState.password} onChange={(e) => updateField("password", e.target.value)} className={inputCls} />
        </label>
        <label className="block col-span-3">
          <span className={labelCls}>Confirm Password</span>
          <input autoComplete="new-password" minLength={8} name="confirm_password" required type="password" value={formState.confirmPassword} onChange={(e) => updateField("confirmPassword", e.target.value)} onBlur={(e) => handleMatchPassword(e.target.value)} className={inputCls} />
        </label>

        {successMessage ? (
          <label className="block col-span-6">
            <p aria-live="polite" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 sm:col-span-2">
              {successMessage}
            </p>
          </label>
        ) : null}

        {errorMessage ? (
          <label className="block col-span-6">
            <p aria-live="polite" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300 sm:col-span-2">
              {errorMessage}
            </p>
          </label>
        ) : null}

        <label className="flex col-span-6 justify-center">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full h-11 mt-10 items-center cursor-pointer justify-center gap-2 rounded-md bg-tournament-primary px-4 text-sm font-semibold text-white transition hover:bg-tournament-primary disabled:cursor-not-allowed disabled:bg-zinc-400 sm:col-span-2"
          >
            {isSubmitting ? "Creating account..." : (<><IconUserPlus className="h-4 w-4" />Create Account</>)}
          </button>
        </label>
      </form>
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-emerald-700 dark:text-emerald-400">Log in</Link>
      </p>
    </>
  );
}
