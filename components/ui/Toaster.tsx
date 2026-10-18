"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

type Toast = { id: number; message: string; tone: "success" | "error" | "info" };
let nextId = 1;
const listeners = new Set<(t: Toast) => void>();

/** Fire-and-forget toast from anywhere on the client. */
export function toast(message: string, tone: Toast["tone"] = "success") {
  const t = { id: nextId++, message, tone };
  listeners.forEach((l) => l(t));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    const onToast = (t: Toast) => {
      setItems((prev) => [...prev.slice(-2), t]);
      window.setTimeout(() => setItems((prev) => prev.filter((p) => p.id !== t.id)), 3200);
    };
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-[85] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="glass pointer-events-auto flex items-center gap-3 rounded-full px-5 py-3 text-sm shadow-2xl"
          >
            {t.tone === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
            ) : t.tone === "error" ? (
              <XCircle className="h-4 w-4 text-danger" aria-hidden />
            ) : (
              <Info className="h-4 w-4 text-ember" aria-hidden />
            )}
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
