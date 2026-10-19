import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "golden_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 dias

export type Session = { userId: string; name: string; role: "ADMIN" | "ATENDENTE" };

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("Defina AUTH_SECRET (mín. 16 caracteres) no .env");
  return new TextEncoder().encode(s);
}

export async function createSessionToken(session: Session) {
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function setSessionCookie(session: Session) {
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function getSession() {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Usar em server actions e páginas protegidas */
export async function requireSession() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}
