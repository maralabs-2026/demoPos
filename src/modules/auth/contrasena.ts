// Sin caracteres que se confunden al dictarla (0/O, 1/l/I).
const CARACTERES = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const LARGO_CONTRASENA_SUGERIDA = 12;

// Contraseña temporal al azar. Descarta los valores que sesgarían la elección de caracteres.
export function sugerirContrasena(): string {
  const limite = 256 - (256 % CARACTERES.length);
  let resultado = "";
  while (resultado.length < LARGO_CONTRASENA_SUGERIDA) {
    for (const byte of crypto.getRandomValues(new Uint8Array(32))) {
      if (byte < limite && resultado.length < LARGO_CONTRASENA_SUGERIDA) {
        resultado += CARACTERES[byte % CARACTERES.length];
      }
    }
  }
  return resultado;
}
