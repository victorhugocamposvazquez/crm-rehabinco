import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Catastro Explorer",
};

export default function CatastroLayout({ children }: { children: React.ReactNode }) {
  return children;
}
