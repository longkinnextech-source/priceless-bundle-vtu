import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <AuthForm mode="signup" />
    </div>
  );
}
