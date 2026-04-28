import React from "react";
import { motion } from "framer-motion";

export default function PrefixDisplay({ prefix }) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Prefiks
      </span>
      <motion.div
        key={prefix}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="font-mono text-4xl sm:text-5xl font-bold text-primary tracking-tight"
      >
        {prefix}
        <span className="text-primary/30">...</span>
      </motion.div>
    </div>
  );
}
