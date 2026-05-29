"use client";

import { useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import type { UserRole } from "@/lib/auth";

type RouteGuardProps = {
  children: ReactNode;
  allowedRoles?: readonly UserRole[];
};

export function RouteGuard({ children, allowedRoles }: RouteGuardProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      // Guard all routes except public ones if not authenticated.
      // (Assuming pages under /admin or /predictions require auth)
      const isPublicPath = pathname === "/login" || pathname === "/signup" || pathname === "/";
      if (!isPublicPath) {
        router.replace("/login");
      }
      return;
    }

    // Role-based logic
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      if (user.role === "ADMIN") {
        // Admins should be sent to the admin dashboard
        router.replace("/admin");
      } else {
        // Users without roles (e.g. USER trying to access admin pages)
        router.replace("/");
      }
    }
  }, [user, isLoading, allowedRoles, router, pathname]);

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-emerald-700" />
        <p className="mt-4 text-sm font-medium text-zinc-500">Checking credentials...</p>
      </div>
    );
  }

  // If user state is not matched yet, return null to prevent layout flash.
  if (allowedRoles && (!user || !allowedRoles.includes(user.role))) {
    return null;
  }

  return <>{children}</>;
}
