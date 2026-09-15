/** RFC 4180 quoting plus formula-injection protection for untrusted text fields. */
export function csvCell(value: string | number | null) {
  if (typeof value === "number") return String(value);
  let text = value ?? "";
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
