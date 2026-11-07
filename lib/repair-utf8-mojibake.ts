/** Repairs UTF-8 text accidentally interpreted as Windows-1252. */
const CP1252_EXTRAS = [
  '\u20ac', '\u0081', '\u201a', '\u0192', '\u201e', '\u2026', '\u2020', '\u2021',
  '\u02c6', '\u2030', '\u0160', '\u2039', '\u0152', '\u008d', '\u017d', '\u008f',
  '\u0090', '\u2018', '\u2019', '\u201c', '\u201d', '\u2022', '\u2013', '\u2014',
  '\u02dc', '\u2122', '\u0161', '\u203a', '\u0153', '\u009d', '\u017e', '\u0178',
] as const;
const EXTRA_BYTES = new Map<string, number>(CP1252_EXTRAS.map((value, i) => [value, i + 0x80]));
const INVALID_UTF8 = /(?:[\u00c3\u00c2][^\x00-\x7f]|\u00e2[^\x00-\x7f]{2})+/g;

function rawByte(char: string) {
  const code = char.charCodeAt(0);
  return code <= 255 ? code : EXTRA_BYTES.get(char) ?? null;
}
export function repairUtf8Mojibake(input: string): string {
  if (!/[\u00c3\u00c2\u00e2]/.test(input)) return input;
  return input.replace(INVALID_UTF8, (segment) => {
    const raw: number[] = [];
    for (const char of segment) {
      const byte = rawByte(char);
      if (byte === null) return segment;
      raw.push(byte);
    }
    try {
      const repaired = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(raw));
      return repaired.includes('\ufffd') ? segment : repaired;
    } catch { return segment; }
  });
}
