import type { Metadata } from "next"
import "./globals.css"

const description =
  "A trilha sonora da sua mesa de RPG online: o mestre comanda camadas de som com vídeos do YouTube e todos os jogadores ouvem o mesmo som, ao mesmo tempo."

// Title, description and image shown when a link is shared (WhatsApp, Discord, etc.).
export const metadata: Metadata = {
  metadataBase: new URL("https://rpjams.vercel.app"),
  title: "RPJams",
  description,
  openGraph: {
    title: "RPJams",
    description,
    siteName: "RPJams",
    locale: "pt_BR",
    type: "website",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Logo do RPJams" }],
  },
  twitter: { card: "summary_large_image", title: "RPJams", description, images: ["/og.jpg"] },
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
