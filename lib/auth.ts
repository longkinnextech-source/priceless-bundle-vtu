import { cookies } from "next/headers";
import crypto from "node:crypto";
import { one } from "./db";

export const SESSION_COOKIE = "pb_session";
export const ADMIN_COOKIE = "pb_admin";

const SECRET = process.env.SESSION_SECRET || "priceless-bundle-dev-secret-change-me";

function sign(value: string): string {
  return crypto.createHmac("sha256", SECRET).update(value).digest("base64url");
}

function makeToken(userId: string): string {
  const ts = Date.now().toString(36);
  const payload = `${userId}.${ts}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, ts, sig] = parts;
  const expected = sign(`${userId}.${ts}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const ageMs = Date.now() - parseInt(ts, 36);
  if (!Number.isFinite(ageMs) || ageMs > 1000 * 60 * 60 * 24 * 30) return null; // 30 days
  return userId;
}

export type SessionUser = {
  id: string;
  phone: string;
  name: string | null;
  tier: "customer" | "sub_agent" | "super_agent";
  is_admin: boolean;
};

export function setSessionCookie(userId: string) {
  cookies().set(SESSION_COOKIE, makeToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie() {
  cookies().set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}

export function setAdminCookie() {
  cookies().set(ADMIN_COOKIE, makeToken("admin"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export function clearAdminCookie() {
  cookies().set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
}

export function isAdminCookieValid(): boolean {
  return verifyToken(cookies().get(ADMIN_COOKIE)?.value) === "admin";
}

export async function currentUser(): Promise<SessionUser | null> {
  const userId = verifyToken(cookies().get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const u = await one<SessionUser>(
    "select id, phone, name, tier, is_admin from users where id = $1 and is_active = true",
    [userId]
  );
  return u ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw new Error("UNAUTHENTICATED");
  return u;
}
