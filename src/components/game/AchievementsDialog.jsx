import React from "react";
import { CheckCircle2, Lock, Sparkles, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function AchievementsDialog({
  achievements,
  unlockedAchievements,
  open,
  onOpenChange,
  trigger,
}) {
  const unlockedSet = new Set(unlockedAchievements);
  const unlockedCount = achievements.filter((achievement) => unlockedSet.has(achievement.id)).length;
  const totalCount = achievements.length;
  const progressPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-600 dark:text-amber-300" />
            Osiągnięcia
          </DialogTitle>
          <DialogDescription>
            {unlockedCount} z {totalCount} odblokowanych
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium tabular-nums text-muted-foreground">
              <span>Postęp</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-primary/15">
              <div
                className="h-full rounded-full bg-amber-500 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            {achievements.map((achievement) => {
              const unlocked = unlockedSet.has(achievement.id);
              const Icon = unlocked ? CheckCircle2 : Lock;

              return (
                <div
                  key={achievement.id}
                  className={cn(
                    "rounded-lg border p-3 transition-colors",
                    unlocked
                      ? "border-amber-500/35 bg-amber-500/10"
                      : "border-border bg-muted/35"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
                        unlocked
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                          : "bg-background text-muted-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold text-foreground">
                          {unlocked ? achievement.title : "Ukryte osiągnięcie"}
                        </div>
                        <Badge variant={unlocked ? "default" : "secondary"} className="gap-1">
                          {unlocked && <Sparkles className="h-3 w-3" />}
                          {unlocked ? "Odblokowane" : "Zablokowane"}
                        </Badge>
                      </div>
                      <div className="mt-1 text-sm font-medium text-muted-foreground">
                        {unlocked
                          ? achievement.description
                          : "Odblokuj je, aby poznać nazwę i warunek."}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
