import { Inter } from "next/font/google";
import "./corporativa.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-web-corp",
});

export default function WebLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`web-corp min-h-dvh antialiased ${inter.variable} ${inter.className}`}>
      {children}
    </div>
  );
}
