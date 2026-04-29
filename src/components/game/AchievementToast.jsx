import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Trophy } from "lucide-react";

export default function AchievementToast({ achievement, onClose }) {
  React.useEffect(() => {
    if (!achievement) return undefined;

    const timerId = window.setTimeout(onClose, 4200);

    return () => window.clearTimeout(timerId);
  }, [achievement, onClose]);

  return (
    <AnimatePresence>
      {achievement && (
        <div className="fixed bottom-5 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 sm:bottom-6">
          <motion.div
            key={achievement.id}
            initial={{ opacity: 0, y: 18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
            className="overflow-hidden rounded-lg border border-amber-500/35 bg-card text-card-foreground shadow-2xl shadow-amber-500/10"
            role="status"
            aria-live="polite"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-amber-500" />
            <motion.div
              className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-amber-500/15 blur-2xl"
              initial={{ opacity: 0.3, scale: 0.8 }}
              animate={{ opacity: [0.3, 0.75, 0.25], scale: [0.8, 1.1, 0.95] }}
              transition={{ duration: 1.6, ease: "easeOut" }}
            />

            <div className="relative flex gap-3 p-4">
              <motion.div
                initial={{ rotate: -10, scale: 0.7 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 440, damping: 18, delay: 0.08 }}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-300"
              >
                <Trophy className="h-6 w-6" />
              </motion.div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  Osiągnięcie
                </div>
                <div className="mt-1 text-base font-bold text-foreground">
                  {achievement.title}
                </div>
                <div className="mt-0.5 text-sm font-medium text-muted-foreground">
                  {achievement.description}
                </div>
              </div>
            </div>

            <motion.div
              className="h-1 bg-amber-500/45"
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 4.2, ease: "linear" }}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
