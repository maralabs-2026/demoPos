// Logo del comercio: lo usan auth (para mostrarlo) y config (para subirlo), así que vive acá.
// El bucket y los tipos coinciden con la migración 0025.

export const LOGO_BUCKET = "comercios";
export const LOGO_MAX_BYTES = 524_288;

export const LOGO_TIPOS = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
} as const;

export type LogoExtension = keyof typeof LOGO_TIPOS;

// El tipo se decide por los primeros bytes del archivo, no por el nombre ni por lo que diga el
// navegador, que el usuario controla.
export function tipoDeLogo(bytes: Uint8Array): LogoExtension | null {
  const empieza = (...firma: number[]) =>
    bytes.length >= firma.length && firma.every((b, i) => bytes[i] === b);

  if (empieza(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (empieza(0xff, 0xd8, 0xff)) return "jpg";
  // RIFF....WEBP
  if (
    empieza(0x52, 0x49, 0x46, 0x46) &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}
