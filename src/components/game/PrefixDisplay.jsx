import React from "react";
import { motion } from "framer-motion";
import { parseMiddleAffix } from "@/lib/rounds";

export default function PrefixDisplay({ prefix, mode = "classic" }) {
  const isReverse = mode === "reverse";
  const isMiddle = mode === "middle";
  const middleAffix = isMiddle ? parseMiddleAffix(prefix) : null;

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {isMiddle ? "Środek" : isReverse ? "Końcówka" : "Prefiks"}
      </span>
      <motion.div
        key={prefix}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="font-mono text-4xl sm:text-5xl font-bold text-primary tracking-tight"
      >
        {isMiddle ? (
          <>
            {middleAffix.start}
            <span className="text-primary/30">...</span>
            {middleAffix.end}
          </>
        ) : (
          <>
            {isReverse && <span className="text-primary/30">...</span>}
            {prefix}
            {!isReverse && <span className="text-primary/30">...</span>}
          </>
        )}
      </motion.div>
    </div>
  );
}
