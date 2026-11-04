// Cálculos del cierre para mostrar. El esperado y la diferencia de cada medio salen de la base
// (cerrar_caja): acá solo se suman, en centavos para no arrastrar errores de punto flotante.

export type LineaCierre = {
  medioPagoId: string;
  nombre: string;
  esperado: number;
  contado: number;
  diferencia: number;
};

export type EstadoDiferencia = "cuadra" | "sobra" | "falta";

export function estadoDiferencia(diferencia: number): EstadoDiferencia {
  if (diferencia === 0) return "cuadra";
  return diferencia > 0 ? "sobra" : "falta";
}

function sumar(valores: number[]): number {
  return valores.reduce((acc, v) => acc + Math.round(v * 100), 0) / 100;
}

export function totalesCierre(lineas: LineaCierre[]) {
  return {
    esperado: sumar(lineas.map((l) => l.esperado)),
    contado: sumar(lineas.map((l) => l.contado)),
    diferencia: sumar(lineas.map((l) => l.diferencia)),
  };
}
