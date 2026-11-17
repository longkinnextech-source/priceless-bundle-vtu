"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * The single logo component. Every logo in the app renders through this,
 * and it always points at /public/logo.png — unchanged.
 * If the file is missing, it degrades to the wordmark instead of a broken image.
 */
export function Logo({ size = 36, className = "" }: { size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-xl bg-fire-gradient font-black text-coal-900 ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.42 }}
        aria-label="Priceless Bundle"
      >
        PB
      </span>
    );
  }

  return (
    <Image
      src="/logo.png"
      alt="Priceless Bundle"
      width={size}
      height={size}
      priority
      onError={() => setFailed(true)}
      className={`rounded-xl object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
