import React from "react";
import { Button } from "@/components/ui/button";
import { Eye, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function MissingWords({ words, prefix, foundWords, revealed, onReveal }) {
  const missing = words.filter((word) => !foundWords.includes(word));

  if (missing.length === 0 && foundWords.length > 0) {
    return (
      <div className="text-center py-4 text-accent font-medium text-sm">
        Brawo! Znaleziono wszystkie słowa!
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Brakujące
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReveal}
          disabled={revealed}
          className="h-7 gap-1.5 text-xs text-muted-foreground"
        >
          {revealed ? <Lock className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {revealed ? "Brakujące odkryte" : "Pokaż brakujące"}
        </Button>
      </div>

      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-1.5">
              {missing.map((word) => (
                <span
                  key={word}
                  className="inline-block px-2.5 py-1 bg-secondary text-muted-foreground border border-border rounded-md text-sm"
                >
                  <span className="font-semibold">{prefix}</span>
                  {word.slice(prefix.length)}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
