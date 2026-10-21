import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "RPJams",
  description: "Música e ambiente sincronizados para a sua mesa de RPG",
}

// Light is the default; runs before the page paints, so there is no flash of the wrong theme.
const themeScript = `try{var t=localStorage.getItem("rpjams:theme");document.documentElement.dataset.theme=t==="dark"?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
