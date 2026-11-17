"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";

export function JoinClient({ refId }: { refId: string }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function join() {
    setBusy(true);
    try {
      const res = await fetch("/api/squad/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: refId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push(json?.error?.message || "Could not join that squad.", "error");
        return;
      }
      setDone(true);
      push("You joined the squad.", "success");
      setTimeout(() => router.push("/agent"), 900);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card card-pad text-center">
      <h1 className="text-xl font-extrabold text-ember-50">Join this squad</h1>
      <p className="mt-2 text-sm text-ember-100/60">
        You will keep agent pricing, and your sales will count toward the squad&apos;s monthly volume target.
      </p>
      <button type="button" onClick={join} disabled={busy || done} className="btn-primary mt-5 w-full">
        {done ? "Joined" : busy ? "Joining…" : "Join squad"}
      </button>
    </div>
  );
}
