"use client"

import { useState } from "react"

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="linkbox">
      <input type="text" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          } catch {}
        }}
      >
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  )
}
