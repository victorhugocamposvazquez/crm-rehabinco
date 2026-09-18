/** Bloqueo DataDome / challenge corto (no reCAPTCHA embebido en fichas largas). */
export function bloqueoDatadomeOChallenge(status: number, body: string): boolean {
  if (status === 403 || status === 429) return true;
  const b = body.toLowerCase();
  if (b.includes("datadome") || b.includes("cf-challenge") || b.includes("attention required")) {
    return true;
  }
  return body.length < 8000 && b.includes("captcha");
}
