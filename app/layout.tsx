import type { Metadata } from "next";
import "./globals.css";

const REPO_URL = "https://github.com/imc786/airlock";
const SITE_URL = "https://airlock.westernpixel.com";

export const metadata: Metadata = {
  title: "Airlock - the golden pnpm 11 CI template",
  description:
    "A CI-green reference wiring pnpm 11 supply-chain defaults, a regenerating audit-fix pipeline, Dependabot cooldown and SHA-matched unattended auto-merge for solo Next.js on Vercel.",
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  openGraph: {
    title: "Airlock",
    description: "The golden pnpm 11 + Dependabot + audit-fix CI template for solo Next.js on Vercel.",
    url: SITE_URL,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Airlock",
    description: "The golden pnpm 11 + Dependabot + audit-fix CI template for solo Next.js on Vercel.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Airlock",
  url: SITE_URL,
  codeRepository: REPO_URL,
  creator: {
    "@type": "Organization",
    name: "Western Pixel",
    url: "https://westernpixel.com",
  },
};

// Set data-theme before paint so a stored preference does not flash the wrong theme on load.
const noFlashTheme = `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        {children}
      </body>
    </html>
  );
}
