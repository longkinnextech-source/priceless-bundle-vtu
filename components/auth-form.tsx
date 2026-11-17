"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { useToast } from "@/components/toast";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const { push } = useToast();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [asAgent, setAsAgent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [mode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "login"
            ? { phone, pin }
            : { phone, pin, name, tier: asAgent ? "sub_agent" : "customer" }
        ),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message || "Something went wrong.");
        return;
      }
      push(mode === "login" ? "Welcome back." : "Account created.", "success");
      router.push("/wallet");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <Logo size={56} />
        <h1 className="text-2xl font-extrabold tracking-tight text-ember-50">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-sm text-ember-100/60">
          {mode === "login"
            ? "Log in with your phone number and PIN."
            : "One account for buying data, topping up and earning as an agent."}
        </p>
      </div>

      <form onSubmit={submit} className="card card-pad space-y-4">
        <div>
          <label className="label" htmlFor="phone">Phone number</label>
          <input
            id="phone"
            className="input"
            inputMode="tel"
            autoComplete="tel"
            placeholder="024 000 0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>

        {mode === "signup" && (
          <div>
            <label className="label" htmlFor="name">Name (optional)</label>
            <input
              id="name"
              className="input"
              autoComplete="name"
              placeholder="e.g. Ama Mensah"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="label" htmlFor="pin">PIN</label>
          <input
            id="pin"
            className="input"
            type="password"
            inputMode="numeric"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="At least 4 digits"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
            minLength={4}
          />
        </div>

        {mode === "signup" && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-coal-600 bg-coal-900/60 p-3">
            <input
              type="checkbox"
              checked={asAgent}
              onChange={(e) => setAsAgent(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-ember-500"
            />
            <span className="text-sm text-ember-100/80">
              <span className="font-semibold text-ember-100">Sign up as a Sub-Agent</span>
              <span className="mt-0.5 block text-xs text-ember-100/55">
                Free. Unlocks agent pricing on every bundle. You can switch later.
              </span>
            </span>
          </label>
        )}

        {error && (
          <p className="rounded-lg border border-flame-600/40 bg-flame-700/15 px-3 py-2 text-sm text-flame-400">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>

        <p className="text-center text-sm text-ember-100/55">
          {mode === "login" ? (
            <>New here? <a href="/signup" className="font-semibold text-ember-300 hover:underline">Create an account</a></>
          ) : (
            <>Already have an account? <a href="/login" className="font-semibold text-ember-300 hover:underline">Log in</a></>
          )}
        </p>
      </form>
    </div>
  );
}
