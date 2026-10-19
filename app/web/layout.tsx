import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { CookieBanner } from "@/components/web/corporativa/CookieBanner";
import { metadataCorporativa } from "@/lib/web/corporativa/metadata-seo";
import "./corporativa.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-web-corp",
});

export async function generateMetadata(): Promise<Metadata> {
  return metadataCorporativa();
}

export default function WebLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`web-corp min-h-dvh w-full min-w-0 max-w-full antialiased ${inter.variable} ${inter.className}`}>
      {children}
      <CookieBanner />
    </div>
  );
}
