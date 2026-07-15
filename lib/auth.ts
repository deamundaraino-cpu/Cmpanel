import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "bp_session";
const DAYS = 30;

function getPassword() {
  return process.env.APP_PASSWORD || "adshouse";
}

function getSecret() {
  return process.env.SESSION_SECRET || "bp-secret-" + getPassword();
}

function sign(expiry: string) {
  return createHmac("sha256", getSecret()).update(expiry).digest("hex");
}

export function checkPassword(password: string) {
  const a = Buffer.from(password);
  const b = Buffer.from(getPassword());
  return a.length === b.length && timingSafeEqual(a, b);
}

export function makeSessionValue(): { value: string; maxAge: number } {
  const expiry = String(Date.now() + DAYS * 86400_000);
  return { value: `${expiry}.${sign(expiry)}`, maxAge: DAYS * 86400 };
}

export async function isAuthed(): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return false;
  const [expiry, sig] = raw.split(".");
  if (!expiry || !sig) return false;
  if (Number(expiry) < Date.now()) return false;
  const expected = sign(expiry);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const SESSION_COOKIE = COOKIE;
