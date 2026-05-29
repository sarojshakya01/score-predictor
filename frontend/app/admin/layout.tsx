import { RouteGuard } from "@/components/auth/route-guard";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <section className="flex flex-1 flex-col">
        {children}
      </section>
    </RouteGuard>
  );
}
