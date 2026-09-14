export const c = {
  bg: "#F7F6F2",
  surface: "#FFFFFF",
  surfaceSoft: "#FBFBF9",
  ink: "#131C1A",
  text2: "#5D6B67",
  label: "#6B7A76",
  text3: "#8A938F",
  line: "#E6E3DD",
  lineSoft: "#EFEDE7",
  lineRow: "#F2F0EB",
  inputBorder: "#DAD6CE",
  green: "#0B7461",
  greenDark: "#08594B",
  greenSoft: "#E8F3EF",
  rowActive: "#F4F8F6",
  amber: "#B98A16",
  amberBg: "#FBF0D8",
  amberInk: "#7A5A10",
  blue: "#2B4A8A",
  blueSoft: "#E9EEF8",
  violet: "#8579C4",
  violetBg: "#F1EFF8",
  violetInk: "#4B3F8A",
  red: "#A33B2A",
  redBg: "#FBEAE5",
} as const;

export const COMERCIAL_COLORS = [
  "#3A6A82",
  "#0B7461",
  "#B98A16",
  "#8579C4",
  "#C0644F",
  "#2B4A8A",
] as const;

export function inicialesNombre(nombre?: string | null, email?: string | null): string {
  const source = (nombre?.trim() || email?.split("@")[0] || "U").trim();
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
