import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "700"],
});
const sans = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "税联 · AP 工作台",
  description: "给会计师的多客户应付账款工作台 — 收单 · 识别 · 分类 · 录入 QuickBooks",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh-CN"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
