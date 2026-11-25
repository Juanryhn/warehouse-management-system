import Link from "next/link";

export const Pagination = ({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string>;
}) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages < 2) return null;

  const href = (target: number) => {
    const search = new URLSearchParams(params);
    search.set("page", String(target));
    return `${basePath}?${search.toString()}`;
  };

  const linkClass = (disabled: boolean) =>
    `inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition ${
      disabled
        ? "pointer-events-none border-zinc-200 text-zinc-300 dark:border-zinc-800 dark:text-zinc-700"
        : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
    }`;

  return (
    <nav aria-label="Pagination" className="mt-5 flex items-center justify-between gap-4">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Page {page} of {pages} · {total} records
      </p>
      <div className="flex items-center gap-2">
        <Link href={href(Math.max(1, page - 1))} className={linkClass(page <= 1)} aria-disabled={page <= 1}>
          Previous
        </Link>
        <Link href={href(Math.min(pages, page + 1))} className={linkClass(page >= pages)} aria-disabled={page >= pages}>
          Next
        </Link>
      </div>
    </nav>
  );
};
