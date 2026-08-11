/**
 * ISIN-Prüfziffer nach ISO 6166 (Luhn über die alphanumerisch expandierte
 * Zeichenkette). Fängt Tippfehler und OCR-Fehllesungen ab, bevor sie
 * gespeichert werden — genutzt sowohl beim manuellen Erfassen als auch beim
 * Foto-Import.
 */
export function isValidIsin(isin: string): boolean {
  const s = isin.trim().toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(s)) return false;

  const digits = [...s]
    .map((ch) => (/[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch))
    .join('');

  let sum = 0;
  let double = true; // von rechts: die vorletzte Stelle wird zuerst verdoppelt
  for (let i = digits.length - 2; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[digits.length - 1]);
}
