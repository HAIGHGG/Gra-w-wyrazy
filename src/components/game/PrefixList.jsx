import React from "react";
import { Lock, Search, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PrefixList({
  prefixes,
  activePrefix,
  progressByPrefix,
  wordCounts,
  onSelect,
  disabled,
  title = "Prefiksy",
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {title}
        </span>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {prefixes.length}
        </span>
      </div>

      <div className="max-h-[360px] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {prefixes.map((prefix) => {
          const progress = progressByPrefix[prefix] || {
            foundWords: [],
            revealedMissing: false,
          };
          const found = progress.foundWords.length;
          const total = wordCounts[prefix];
          const percent = total ? Math.round((found / total) * 100) : 0;
          const isActive = prefix === activePrefix;
          const isComplete = total > 0 && found >= total;

          return (
            <button
              key={prefix}
              type="button"
              onClick={() => onSelect(prefix)}
              disabled={disabled}
              className={cn(
                "group rounded-lg border px-3 py-2 text-left transition hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60",
                isActive
                  ? "border-primary/50 bg-primary/10"
                  : "border-border bg-background/60",
                progress.revealedMissing && "border-yellow-500/35 bg-yellow-500/10"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-lg font-bold text-foreground">
                  {prefix}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                  {progress.revealedMissing ? (
                    <>
                      <Lock className="h-3.5 w-3.5 text-yellow-600" />
                      odkryte
                    </>
                  ) : isComplete ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                      komplet
                    </>
                  ) : isActive ? (
                    <>
                      <Search className="h-3.5 w-3.5 text-primary" />
                      aktywny
                    </>
                  ) : null}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between text-xs font-medium tabular-nums text-muted-foreground">
                <span>
                  {found} / {typeof total === "number" ? total : "..."} słów
                </span>
                <span>{typeof total === "number" ? `${percent}%` : ""}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary/15">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    progress.revealedMissing ? "bg-yellow-500" : "bg-accent"
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}
