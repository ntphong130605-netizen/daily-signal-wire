import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "dsw_admin";
const MAX_AGE_SECONDS = 60 * 60 * 12;

function secret() {
  return process.env.ADMIN_SESSION_SECRET || "";
}

function signature(timestamp: string) {
  return createHmac("sha256", secret()).update(timestamp).digest("hex");
}

export function createAdminSession() {
  if (secret().length < 32) {
    throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters.");
  }
  const timestamp = String(Math.floor(Date.now() / 1000));
  return `${timestamp}.${signature(timestamp)}`;
}

export function verifyAdminSession(value: string | undefined) {
  if (!value || secret().length < 32) return false;
  const [timestamp, supplied] = value.split(".");
  if (!timestamp || !supplied) return false;
  const expected = signature(timestamp);
  if (supplied.length !== expected.length) return false;
  const valid = timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  return valid && Number.isFinite(age) && age >= 0 && age <= MAX_AGE_SECONDS;
}

export async function isAdmin() {
  const store = await cookies();
  return verifyAdminSession(store.get(COOKIE_NAME)?.value);
}

export async function requireAdmin() {
  if (!(await isAdmin())) {
    throw new Error("UNAUTHORIZED");
  }
}

export const adminCookie = {
  name: COOKIE_NAME,
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS
  }
};
