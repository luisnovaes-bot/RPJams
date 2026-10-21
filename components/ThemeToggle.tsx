"use client"

import { useEffect, useState } from "react"

type Theme = "light" | "dark"

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark"
}

/** Switches between light and dark. The choice is remembered on this computer. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null)
  useEffect(() => setTheme(currentTheme()), [])

  function toggle() {
    const next: Theme = currentTheme() === "light" ? "dark" : "light"
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem("rpjams:theme", next)
    } catch {}
    setTheme(next)
  }

  return (
    <button className="theme-toggle" onClick={toggle} title={theme === "light" ? "Mudar para modo escuro" : "Mudar para modo claro"}>
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  )
}
