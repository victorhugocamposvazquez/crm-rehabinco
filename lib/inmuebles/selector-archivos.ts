/**
 * En iPad, un input file con display:none dentro de un panel fixed
 * no abre el carrete. El input tiene que vivir en document.body.
 */
let selectorActivo: HTMLInputElement | null = null;

export function abrirSelectorArchivos(opciones: {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
}): void {
  if (typeof document === "undefined") return;
  selectorActivo?.remove();
  const input = document.createElement("input");
  input.type = "file";
  input.accept = opciones.accept;
  input.multiple = opciones.multiple !== false;
  input.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;z-index:2147483647;";
  selectorActivo = input;
  const cerrar = () => {
    if (selectorActivo === input) selectorActivo = null;
    input.remove();
  };
  input.addEventListener("change", () => {
    const files = input.files ? Array.from(input.files) : [];
    cerrar();
    if (files.length) opciones.onFiles(files);
  });
  document.body.appendChild(input);
  input.click();
}

/** iPadOS se identifica como Mac. El carrete y el canvas no se comportan igual. */
export function esIpadOIphone(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}
