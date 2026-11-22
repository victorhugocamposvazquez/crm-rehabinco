import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Cormorant_Garamond, Fraunces, Inter, JetBrains_Mono, Libre_Baskerville, Lora, Manrope, Montserrat, Oswald, Playfair_Display, Poppins } from "next/font/google";
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
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const montserrat = Montserrat({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-montserrat" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-poppins" });
const oswald = Oswald({ subsets: ["latin"], variable: "--font-oswald" });
const playfair = Playfair_Display({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-playfair" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "700"], style: ["normal", "italic"], variable: "--font-cormorant" });
const libre = Libre_Baskerville({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-libre" });
const lora = Lora({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-lora" });

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
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable} ${inter.variable} ${fraunces.variable} ${bebas.variable} ${jetbrains.variable} ${manrope.variable} ${montserrat.variable} ${poppins.variable} ${oswald.variable} ${playfair.variable} ${cormorant.variable} ${libre.variable} ${lora.variable}`} suppressHydrationWarning>
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
