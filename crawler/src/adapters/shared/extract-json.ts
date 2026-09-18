const INITIAL_VARS = [
  "window.__INITIAL_PROPS__",
  "window.__INITIAL_CONTEXT_VALUE__",
  "window.__INITIAL_DATA__",
] as const;

export function extraerJsonParse(html: string, varName: string): unknown | null {
  const spaced = `${varName} = JSON.parse(`;
  const tight = `${varName}=JSON.parse(`;
  for (const marker of [spaced, tight]) {
    const idx = html.indexOf(marker);
    if (idx < 0) continue;
    const parsed = leerStringJsonParse(html, idx + marker.length);
    if (parsed != null) return parsed;
  }
  return null;
}

function leerStringJsonParse(html: string, start: number): unknown | null {
  let i = start;
  while (i < html.length && html[i] !== '"') i += 1;
  if (html[i] !== '"') return null;
  i += 1;
  const chunks: string[] = [];
  for (; i < html.length; i += 1) {
    const c = html[i];
    if (c === "\\") {
      const n = html[++i];
      if (n === "n") chunks.push("\n");
      else if (n === "r") chunks.push("\r");
      else if (n === "t") chunks.push("\t");
      else if (n === '"') chunks.push('"');
      else if (n === "\\") chunks.push("\\");
      else if (n === "u") {
        chunks.push(String.fromCharCode(parseInt(html.slice(i + 1, i + 5), 16)));
        i += 4;
      } else chunks.push(n ?? "");
      continue;
    }
    if (c === '"') break;
    chunks.push(c);
  }
  try {
    return JSON.parse(chunks.join(""));
  } catch {
    return null;
  }
}

/** Fotocasa: JSON en `<script id="__initial_props__">`. */
export function extraerScriptJson(html: string, id: string): unknown | null {
  const re = new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)<\\/script>`, "i");
  const m = html.match(re);
  if (!m?.[1]) return null;
  try {
    return JSON.parse(m[1].trim());
  } catch {
    return null;
  }
}

export function extraerInitialProps(html: string): unknown | null {
  for (const varName of INITIAL_VARS) {
    const raw = extraerJsonParse(html, varName);
    if (raw && typeof raw === "object") return raw;
  }
  return null;
}
