import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";

export default function WordList({ words, prefix, mode = "classic" }) {
  if (words.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
        Wpisz pierwsze słowo, aby rozpocząć
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <AnimatePresence mode="popLayout">
        {words.map((word) => (
          <motion.span
            key={word}
            layout
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.15 }}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent/10 text-accent border border-accent/20 rounded-md text-sm font-medium"
          >
            <Check className="w-3 h-3" />
            {mode === "reverse" ? (
              <span>
                {word.slice(0, -prefix.length)}
                <span className="font-bold">{prefix}</span>
              </span>
            ) : (
              <span>
                <span className="font-bold">{prefix}</span>
                {word.slice(prefix.length)}
              </span>
            )}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
