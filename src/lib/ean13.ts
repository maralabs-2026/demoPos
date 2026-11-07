// EAN-13: dígito verificador y patrón de barras para dibujar el código en las etiquetas.
// Los códigos internos (prefijo 20) los genera la base con siguiente_codigo_interno (0027).

const L = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
];
const G = [
  "0100111",
  "0110011",
  "0011011",
  "0100001",
  "0011101",
  "0111001",
  "0000101",
  "0010001",
  "0001001",
  "0010111",
];
const R = [
  "1110010",
  "1100110",
  "1101100",
  "1000010",
  "1011100",
  "1001110",
  "1010000",
  "1000100",
  "1001000",
  "1110100",
];
// El primer dígito no se dibuja: decide si cada dígito de la mitad izquierda va con L o con G.
const PARIDAD = [
  "LLLLLL",
  "LLGLGG",
  "LLGGLG",
  "LLGGGL",
  "LGLLGG",
  "LGGLLG",
  "LGGGLL",
  "LGLGLG",
  "LGLGGL",
  "LGGLGL",
];

export const MODULOS_EAN13 = 95;

/** Dígito verificador de los 12 primeros dígitos de un EAN-13. */
export function digitoVerificador(cuerpo: string): number {
  if (!/^\d{12}$/.test(cuerpo)) {
    throw new Error("El cuerpo de un EAN-13 tiene 12 dígitos");
  }
  let suma = 0;
  for (let i = 0; i < 12; i++) {
    suma += Number(cuerpo[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (suma % 10)) % 10;
}

export function esEan13(codigo: string): boolean {
  return (
    /^\d{13}$/.test(codigo) &&
    digitoVerificador(codigo.slice(0, 12)) === Number(codigo[12])
  );
}

export function esCodigoInterno(codigo: string): boolean {
  return codigo.startsWith("20") && esEan13(codigo);
}

/**
 * Los 95 módulos del código, de izquierda a derecha: "1" es barra y "0" es espacio.
 * Devuelve null si el código no es un EAN-13 válido.
 */
export function barrasEan13(codigo: string): string | null {
  if (!esEan13(codigo)) return null;
  const paridad = PARIDAD[Number(codigo[0])];
  let izquierda = "";
  for (let i = 1; i <= 6; i++) {
    const tabla = paridad[i - 1] === "L" ? L : G;
    izquierda += tabla[Number(codigo[i])];
  }
  let derecha = "";
  for (let i = 7; i <= 12; i++) derecha += R[Number(codigo[i])];
  return `101${izquierda}01010${derecha}101`;
}
