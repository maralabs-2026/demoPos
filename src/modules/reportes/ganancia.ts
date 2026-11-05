// Ganancia para mostrar. Sin ningún costo cargado no es $ 0: es desconocida (sección 3 de CLAUDE.md).

type ResumenGanancia = {
  total: number;
  ganancia: number;
  sinCosto: number;
  gastosPagados: number;
};

export function sinCostosCargados(resumen: ResumenGanancia): boolean {
  return (
    resumen.sinCosto > 0 &&
    resumen.ganancia === 0 &&
    resumen.sinCosto >= resumen.total
  );
}

// Ganancia estimada menos gastos pagados, o null si la ganancia es desconocida.
export function gananciaNeta(resumen: ResumenGanancia): number | null {
  if (sinCostosCargados(resumen)) return null;
  return (
    (Math.round(resumen.ganancia * 100) -
      Math.round(resumen.gastosPagados * 100)) /
    100
  );
}
