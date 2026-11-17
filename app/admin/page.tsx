import type { Metadata } from "next";
import { AdminClient } from "@/components/admin-client";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold tracking-tight text-ember-50 sm:text-3xl">Admin</h1>
        <p className="mt-1 text-sm text-ember-100/55">
          Pricing, orders, revenue and the unmatched-deposit queue.
        </p>
      </div>
      <AdminClient />
    </div>
  );
}
