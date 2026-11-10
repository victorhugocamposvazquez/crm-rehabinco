import type { ReactNode } from "react";

const URL_RE = /https?:\/\/[^\s<>"']+/gi;

export function TextoConEnlaces({ texto, className }: { texto: string; className?: string }) {
  const nodos: ReactNode[] = [];
  let cursor = 0;
  for (const match of texto.matchAll(URL_RE)) {
    const url = match[0].replace(/[),.;]+$/, "");
    const inicio = match.index ?? 0;
    if (inicio > cursor) nodos.push(texto.slice(cursor, inicio));
    nodos.push(
      <a
        key={`${inicio}-${url}`}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="break-all text-accent underline underline-offset-2"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    );
    cursor = inicio + match[0].length;
  }
  if (cursor < texto.length) nodos.push(texto.slice(cursor));
  return <span className={className}>{nodos}</span>;
}
