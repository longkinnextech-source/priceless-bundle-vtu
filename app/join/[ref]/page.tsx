import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { JoinClient } from "@/components/join-client";

export const metadata: Metadata = { title: "Join a squad" };
export const dynamic = "force-dynamic";
export default async function JoinPage({ params }: { params: { ref: string } }) {
  const user = await currentUser();
  if (!user) redirect(`/signup?ref=${encodeURIComponent(params.ref)}`);

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <JoinClient refId={params.ref} />
    </div>
  );
}
