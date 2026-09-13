import type { Metadata } from "next";
import { CatastroSubnav } from "@/components/catastro/CatastroSubnav";

export const metadata: Metadata = {
  title: "Catastro Explorer",
};

export default function CatastroLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CatastroSubnav />
      {children}
    </>
  );
}
