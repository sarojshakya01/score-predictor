// import { PageHeader } from "@/components/ui/page-header";

type PageShellProps = {
  actions?: React.ReactNode;
  children: React.ReactNode;
  eyebrow?: string;
  subtitle?: string;
  title: string;
};

export function PageShell({
  actions,
  children,
  eyebrow,
  subtitle,
  title,
}: PageShellProps) {
  return (
    <div className="flex flex-1 flex-col">
      {/* <PageHeader
        actions={actions}
        eyebrow={eyebrow}
        subtitle={subtitle}
        title={title}
      /> */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
