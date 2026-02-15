export function normalizeName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[™®©]/g, "")
    .replace(/[:\-—_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
