import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_KR, Noto_Serif_KR } from "next/font/google";
import "./globals.css";
import { SITE_DESCRIPTION, SITE_INDEXABLE, SITE_NAME, SITE_URL, SITE_VERIFICATION } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const publicSans = Noto_Sans_KR({ variable: '--font-public-sans', subsets: ['latin'], display: 'swap', preload: false });
const publicSerif = Noto_Serif_KR({ variable: '--font-public-serif', weight: '500', subsets: ['latin'], display: 'swap', preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "./" },
  openGraph: { type: "website", locale: "ko_KR", siteName: SITE_NAME, title: SITE_NAME, description: SITE_DESCRIPTION, url: "./" },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION },
  robots: SITE_INDEXABLE ? { index: true, follow: true } : { index: false, follow: false },
  verification: { google: SITE_VERIFICATION.google, other: SITE_VERIFICATION.naver ? { "naver-site-verification": SITE_VERIFICATION.naver } : undefined },
  appleWebApp: { capable: true, title: "좋은교회", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = { themeColor: "#342b25" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} ${publicSans.variable} ${publicSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
