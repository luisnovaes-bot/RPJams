import { randomBytes } from "node:crypto"

const alphabet = "abcdefghijkmnpqrstuvwxyz23456789"

export function randomId(length: number): string {
  const bytes = randomBytes(length)
  let out = ""
  for (const byte of bytes) out += alphabet[byte % alphabet.length]
  return out
}
