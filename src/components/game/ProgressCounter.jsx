import React from "react";
import { Progress } from "@/components/ui/progress";

export default function ProgressCounter({ found, total }) {
  const pct = total > 0 ? Math.round((found / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Postęp
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tabular-nums text-foreground">{found}</span>
          <span className="text-muted-foreground font-medium">/</span>
          <span className="text-2xl font-bold tabular-nums text-muted-foreground">{total}</span>
        </div>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}
