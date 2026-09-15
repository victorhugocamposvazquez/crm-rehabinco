export function extraAlta(search: {
  get: (key: string) => string | null;
  toString: () => string;
}): URLSearchParams | null {
  if (search.get("nueva") !== "1") return null;
  const extra = new URLSearchParams(search.toString());
  extra.delete("nueva");
  return extra;
}
