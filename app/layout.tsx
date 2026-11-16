import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/auth-context";
import { PermisosProvider } from "@/lib/auth/permisos-context";
import { AvisoNuevaVersion } from "@/components/pwa/AvisoNuevaVersion";
import { ToasterConTema } from "@/components/ui/InterruptorTema";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-fraunces" });
const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-bebas" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

const scriptTema = `(function(){try{if(localStorage.getItem("crm-tema")==="dark")document.documentElement.classList.add("dark")}catch(e){}})();`;

export const metadata: Metadata = {
  title: "CRM Inmobiliario",
  description: "Gestión de clientes y facturación",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CRM REHABINCO",
  },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#111111",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable} ${inter.variable} ${fraunces.variable} ${bebas.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <AuthProvider>
          <PermisosProvider>
            {children}
            <AvisoNuevaVersion />
          </PermisosProvider>
        </AuthProvider>
        <ToasterConTema />
      </body>
    </html>
  );
}
