"use client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-500/30 dark:bg-red-500/10">
      <h2 className="text-lg font-semibold text-red-800 dark:text-red-300">Something went wrong</h2>
      <p className="mt-1 text-sm text-red-700 dark:text-red-400">The request could not be completed. Try again.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 h-9 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-500"
      >
        Try again
      </button>
    </div>
  );
}
