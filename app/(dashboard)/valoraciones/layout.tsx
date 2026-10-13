import { PapeleraValoracionesFab } from "@/components/avm/PapeleraValoracionesFab";

export const maxDuration = 60;

export default function ValoracionesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PapeleraValoracionesFab />
    </>
  );
}
