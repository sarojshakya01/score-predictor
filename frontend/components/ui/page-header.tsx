type PageHeaderProps = {
  actions?: React.ReactNode;
  eyebrow?: string;
  subtitle?: string;
  title: string;
};

export function PageHeader({
  actions,
  eyebrow,
  subtitle,
  title,
}: PageHeaderProps) {
  return (
    <section className="flex flex-col gap-5 border-b border-zinc-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-600">
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}
