import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <AuthForm mode="login" />
    </div>
  );
}
