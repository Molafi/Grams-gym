/** Normalise a Jordanian phone to local digits: "+962 79 555 6818", "00962795556818" → "0795556818". */
export function phoneDigits(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("00962")) return `0${d.slice(5)}`;
  if (d.startsWith("962")) return `0${d.slice(3)}`;
  return d;
}
