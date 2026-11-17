import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AgentClient } from "@/components/agent-client";

export const metadata: Metadata = { title: "Agent Dashboard" };
export const dynamic = "force-dynamic";
export default async function AgentPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold tracking-tight text-ember-50 sm:text-3xl">Agent Dashboard</h1>
        <p className="mt-1 text-sm text-ember-100/55">
          Your tier, your squad, and your recruit link — all in one place.
        </p>
      </div>
      <AgentClient userId={user.id} tier={user.tier} phone={user.phone} />
    </div>
  );
}
