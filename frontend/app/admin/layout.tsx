import { RouteGuard } from "@/components/auth/route-guard";
import { RoleName } from "@/lib/auth/types";

const AdminLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <RouteGuard allowedRoles={[RoleName.ADMIN]}>
      <section className="flex flex-1 flex-col">
        {children}
      </section>
    </RouteGuard>
  );
};

export default AdminLayout;
