// Lectura de códigos de barras con la cámara: qué formatos se buscan y cuándo una lectura cuenta.
// La parte que usa la cámara vive en components/camara-codigo.tsx; esto es lógica pura.

// Los de un comercio minorista: productos (EAN/UPC) y etiquetas internas (Code 128).
export const FORMATOS_CODIGO = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
] as const;

export const ZXING_WASM_PATH = "/vendor/zxing/zxing_reader.wasm";

type Lectura = { rawValue: string; format: string };

// El primer código válido de un cuadro, o null. Ignora formatos que no se buscan y valores vacíos.
export function codigoDeLecturas(lecturas: readonly Lectura[]): string | null {
  for (const lectura of lecturas) {
    const valor = lectura.rawValue.trim();
    if (
      valor &&
      (FORMATOS_CODIGO as readonly string[]).includes(lectura.format)
    ) {
      return valor;
    }
  }
  return null;
}

// Una lectura cuenta cuando el mismo código aparece en dos cuadros seguidos: evita que un reflejo o
// un código leído a medias cargue un número equivocado.
export function confirmarLectura(
  anterior: string | null,
  actual: string | null,
): { confirmado: string | null; pendiente: string | null } {
  if (actual === null) return { confirmado: null, pendiente: null };
  if (actual === anterior) return { confirmado: actual, pendiente: null };
  return { confirmado: null, pendiente: actual };
}

// Mensaje para el usuario según el error de getUserMedia.
export function mensajeErrorCamara(nombre: string | undefined): string {
  switch (nombre) {
    case "NotAllowedError":
    case "SecurityError":
      return "No tenemos permiso para usar la cámara. Habilitalo en el navegador o escribí el código.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No encontramos una cámara en este dispositivo. Escribí el código.";
    case "NotReadableError":
      return "Otra aplicación está usando la cámara. Cerrala y probá de nuevo.";
    default:
      return "No se pudo abrir la cámara. Probá de nuevo o escribí el código.";
  }
}
