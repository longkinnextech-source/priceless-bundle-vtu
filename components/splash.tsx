"use client";

import { useEffect, useState } from "react";
import { Logo } from "./logo";

/** Brief branded splash on first paint — logo + wordmark, then fades out. */
export function Splash() {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setGone(true), 900);
    return () => clearTimeout(t);
  }, []);

  if (gone) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-coal-900 transition-opacity duration-500"
      style={{ opacity: gone ? 0 : 1 }}
      aria-hidden
    >
      <Logo size={72} />
      <p className="text-lg font-extrabold tracking-tight text-ember-50">
        Priceless <span className="bg-fire-gradient bg-clip-text text-transparent">Bundle</span>
      </p>
      <div className="h-1 w-32 overflow-hidden rounded-full bg-coal-700">
        <div className="h-full w-1/2 animate-shimmer rounded-full bg-fire-gradient" />
      </div>
    </div>
  );
}
