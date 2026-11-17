"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Toast = { id: number; message: string; kind: "success" | "error" | "info" };

const ToastCtx = createContext<{ push: (m: string, k?: Toast["kind"]) => void }>({ push: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, kind: Toast["kind"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[90] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto animate-fade-up rounded-xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur ${
              t.kind === "success"
                ? "border-ember-500/40 bg-ember-600/20 text-ember-100"
                : t.kind === "error"
                ? "border-flame-600/50 bg-flame-700/25 text-flame-400"
                : "border-coal-600 bg-coal-800/95 text-ember-100"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
