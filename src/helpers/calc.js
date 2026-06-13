export function sanitizeCalc(input) {
  return String(input)
    .replace(/\u00d7|\u00c3\u2014/g, "*")
    .replace(/\u00f7|\u00c3\u00b7/g, "/")
    .replace(/[^0-9+\-*/().\s]/g, "");
}
