import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  success: {
    icon: Check,
    bg: "bg-accent/10 border-accent/30 text-accent",
  },
  duplicate: {
    icon: AlertCircle,
    bg: "bg-yellow-500/10 border-yellow-500/30 text-yellow-600",
  },
  error: {
    icon: X,
    bg: "bg-destructive/10 border-destructive/30 text-destructive",
  },
};

export default function StatusToast({ status }) {
  if (!status) return null;

  const variant = VARIANTS[status.type] || VARIANTS.error;
  const Icon = variant.icon;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status.id || status.message}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium",
          variant.bg
        )}
      >
        <Icon className="w-4 h-4 shrink-0" />
        {status.message}
      </motion.div>
    </AnimatePresence>
  );
}
