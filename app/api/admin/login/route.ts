import { NextResponse } from "next/server"
import { ADMIN_COOKIE, adminToken, passwordMatches } from "@/lib/admin"

export async function POST(request: Request) {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "O painel está desligado: falta configurar ADMIN_PASSWORD" }, { status: 503 })
  }
  const body = (await request.json().catch(() => ({}))) as { password?: unknown }
  if (typeof body.password !== "string" || !passwordMatches(body.password)) {
    // A small delay makes guessing slower.
    await new Promise((resolve) => setTimeout(resolve, 800))
    return NextResponse.json({ error: "Senha incorreta" }, { status: 401 })
  }
  const response = NextResponse.json({ ok: true })
  response.cookies.set(ADMIN_COOKIE, adminToken()!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(ADMIN_COOKIE)
  return response
}
