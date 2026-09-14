import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/auth-context";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { Toaster } from "sonner";

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

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
  themeColor: "#0B7461",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${schibsted.variable} ${plexMono.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <AuthProvider>
          {children}
          <ServiceWorkerRegistration />
        </AuthProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
