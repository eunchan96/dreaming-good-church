import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "꿈꾸는좋은교회",
  description: "꿈꾸는좋은교회 주보와 소식",
  appleWebApp: { capable: true, title: "좋은교회", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = { themeColor: "#253d35" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
