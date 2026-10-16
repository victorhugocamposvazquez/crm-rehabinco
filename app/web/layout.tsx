import { Inter } from "next/font/google";
import "./corporativa.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-web-corp",
});

export default function WebLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`web-corp min-h-dvh ${inter.className}`} style={{ fontFamily: "var(--font-web-corp), Inter, system-ui, sans-serif" }}>
      {children}
    </div>
  );
}
