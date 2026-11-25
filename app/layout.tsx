import type { Metadata, Viewport } from "next";
import { Abril_Fatface, Anton, Archivo, Bebas_Neue, Caveat, Cinzel, Cormorant_Garamond, DM_Sans, EB_Garamond, Figtree, Fraunces, Inter, JetBrains_Mono, Libre_Baskerville, Lora, Manrope, Merriweather, Montserrat, Newsreader, Nunito, Oswald, Outfit, Playfair_Display, Poppins, Raleway } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/auth-context";
import { PermisosProvider } from "@/lib/auth/permisos-context";
import { AvisoNuevaVersion } from "@/components/pwa/AvisoNuevaVersion";
import { ToasterConTema } from "@/components/ui/InterruptorTema";
import { SCRIPT_DISENO } from "@/lib/ui/diseno-config";

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
const dmSans = DM_Sans({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-dm-sans" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const figtree = Figtree({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-figtree" });
const raleway = Raleway({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-raleway" });
const nunito = Nunito({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-nunito" });
const archivo = Archivo({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-archivo" });
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton" });
const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel" });
const merriweather = Merriweather({ subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-merriweather" });
const garamond = EB_Garamond({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-garamond" });
const newsreader = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-newsreader" });
const abril = Abril_Fatface({ subsets: ["latin"], weight: "400", variable: "--font-abril" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat" });

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
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable} ${inter.variable} ${fraunces.variable} ${bebas.variable} ${jetbrains.variable} ${manrope.variable} ${montserrat.variable} ${poppins.variable} ${oswald.variable} ${playfair.variable} ${cormorant.variable} ${libre.variable} ${lora.variable} ${dmSans.variable} ${outfit.variable} ${figtree.variable} ${raleway.variable} ${nunito.variable} ${archivo.variable} ${anton.variable} ${cinzel.variable} ${merriweather.variable} ${garamond.variable} ${newsreader.variable} ${abril.variable} ${caveat.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DISENO }} />
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
