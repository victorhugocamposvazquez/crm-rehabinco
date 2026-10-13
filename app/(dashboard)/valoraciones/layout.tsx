import { PapeleraValoracionesFab } from "@/components/avm/PapeleraValoracionesFab";

export default function ValoracionesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PapeleraValoracionesFab />
    </>
  );
}
