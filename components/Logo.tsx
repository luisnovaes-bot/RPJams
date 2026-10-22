/* eslint-disable @next/next/no-img-element */

/** Small logo for the corner of the panels; links back to the home page. */
export function LogoMark({ corner = false }: { corner?: boolean }) {
  return (
    <a href="/" className={corner ? "logo-corner" : "logo-inline"} title="RPJams">
      <img src="/logo-small.png" alt="RPJams" width={84} height={56} />
    </a>
  )
}

/** Large logo for the home page. */
export function LogoHero() {
  return <img src="/logo.png" alt="RPJams" className="logo-hero" width={840} height={560} />
}
