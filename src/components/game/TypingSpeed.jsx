import React from "react";
import { Gauge } from "lucide-react";

export default function TypingSpeed({ speed }) {
  const isActive = speed.wordCount > 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Tempo
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {speed.wordsPerMinute}
            </span>
            <span className="text-sm font-semibold text-muted-foreground">słów/min</span>
          </div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Gauge className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs font-medium tabular-nums text-muted-foreground">
        <span>Seria</span>
        <span>{speed.wordCount} słów</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/15">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: isActive ? "100%" : "0%" }}
        />
      </div>
    </div>
  );
}
