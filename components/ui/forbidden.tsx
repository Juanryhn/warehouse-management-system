import Link from "next/link";
import { PageHeader } from "./page-header";

export const Forbidden = ({ capability }: { capability: string }) => (
  <>
    <PageHeader title="Not authorised" description="Your role does not have access to this page." />
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-500/30 dark:bg-amber-500/10">
      <p className="text-sm text-amber-800 dark:text-amber-300">
        This area requires the <span className="font-semibold">{capability}</span> permission. Ask an administrator if you need access.
      </p>
      <Link
        href="/"
        className="mt-4 inline-flex h-9 items-center rounded-lg border border-amber-300 px-4 text-sm font-medium text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/20"
      >
        Back to dashboard
      </Link>
    </div>
  </>
);
