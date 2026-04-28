import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Trophy, Zap } from "lucide-react";

export default function LevelProgress({ levelState, lastGain }) {
  const { level, currentXp, xpForNext, percent, totalXp } = levelState;

  return (
    <motion.div
      key={level}
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className="relative overflow-hidden rounded-lg border border-primary/20 bg-card p-4 shadow-sm"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-accent to-chart-3" />

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Poziom
          </span>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary text-base font-bold tabular-nums text-primary-foreground">
              {level}
            </span>
            <div>
              <div className="text-sm font-semibold text-foreground">LVL {level}</div>
              <div className="text-xs font-medium tabular-nums text-muted-foreground">
                {totalXp} XP razem
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence mode="popLayout">
          {lastGain && (
            <motion.div
              key={lastGain.id}
              initial={{ opacity: 0, y: 12, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
              className="inline-flex items-center gap-1 rounded-md border border-accent/25 bg-accent/10 px-2.5 py-1 text-sm font-bold tabular-nums text-accent"
            >
              {lastGain.leveledUp ? (
                <Trophy className="h-4 w-4" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              +{lastGain.amount} XP
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs font-medium tabular-nums text-muted-foreground">
          <span>
            {currentXp} / {xpForNext} XP
          </span>
          <span>{percent}%</span>
        </div>
        <div className="relative h-3 overflow-hidden rounded-full bg-primary/15">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-chart-3"
            initial={false}
            animate={{ width: `${percent}%` }}
            transition={{ type: "spring", stiffness: 180, damping: 24 }}
          />
          <motion.div
            key={lastGain?.id || "idle"}
            initial={{ opacity: 0, x: "-30%" }}
            animate={{ opacity: [0, 0.65, 0], x: "130%" }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="absolute inset-y-0 w-1/3 bg-white/45 blur-sm"
          />
        </div>
      </div>

      <AnimatePresence>
        {lastGain?.leveledUp && (
          <motion.div
            key={`level-up-${lastGain.id}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mt-3 flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm font-semibold text-primary"
          >
            <Sparkles className="h-4 w-4" />
            Awans na LVL {lastGain.level}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
