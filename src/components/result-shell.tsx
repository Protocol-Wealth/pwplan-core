// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

/**
 * result-shell — shared error / running / empty framing for every tool's
 * results panel, so the three panels stay consistent. Presentation only.
 */

export function ResultShell({
  error,
  running,
  hasResult,
  emptyText,
  children,
}: {
  error: string | null;
  running: boolean;
  hasResult: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  if (error) {
    return (
      <section className="border border-red-300 bg-red-50 p-4">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-red-600">
          Engine error
        </h2>
        <p className="mt-2 font-mono text-sm text-red-800">{error}</p>
      </section>
    );
  }

  if (running) {
    return (
      <section className="border border-stone-200 p-4">
        <p className="font-mono text-sm text-stone-500">Awaiting nexus-core…</p>
      </section>
    );
  }

  if (!hasResult) {
    return (
      <section className="border border-dashed border-stone-300 p-4">
        <p className="font-mono text-sm text-stone-400">{emptyText}</p>
      </section>
    );
  }

  return <>{children}</>;
}
