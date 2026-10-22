import { createHmac, timingSafeEqual } from "node:crypto"

export const ADMIN_COOKIE = "rpjams_admin"

/** The cookie value proves the password was typed, without storing the password itself. */
export function adminToken(): string | undefined {
  const password = process.env.ADMIN_PASSWORD
  if (!password) return undefined
  return createHmac("sha256", password).update("rpjams-admin").digest("hex")
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function passwordMatches(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD
  return !!expected && same(password, expected)
}

export function isAdmin(request: Request): boolean {
  const token = adminToken()
  if (!token) return false
  const cookie = request.headers.get("cookie") ?? ""
  const value = cookie
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === ADMIN_COOKIE)?.[1]
  return !!value && same(value, token)
}
