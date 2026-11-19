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

// --- Desglose del esperado de cada medio ---
// La base calcula el esperado de un medio como lo cobrado con él en las ventas de la caja, más el
// fondo inicial, los ingresos y los retiros en el medio de efectivo que recibe el fondo
// (caja_esperado_por_medio). Acá se rearma esa suma para mostrar qué ventas la forman.

export type PagoDeVenta = { medioPagoId: string; monto: number };

export type VentaDeCaja = {
  id: string;
  createdAt: string;
  cajero: string;
  anulada: boolean;
  anuladaAt: string | null;
  pagos: PagoDeVenta[];
};

export type VentaDelMedio = {
  id: string;
  createdAt: string;
  cajero: string;
  monto: number;
  combinado: boolean;
  // Anulada antes del cierre: no sumó en el esperado. Anulada después: sí sumó, porque el cierre
  // no cambia.
  anulada: "no" | "antes" | "despues";
};

export type DesgloseMedio = {
  ventas: VentaDelMedio[];
  totalVentas: number;
  // Solo en el medio que recibe el fondo; null en los demás o si fondo y movimientos dan cero.
  caja: { fondo: number; ingresos: number; retiros: number } | null;
  // Lo que no se explica con ventas ni movimientos. Debería ser siempre cero.
  sinDetalle: number;
};

const centavos = (v: number) => Math.round(v * 100);

function estadoAnulacion(
  venta: VentaDeCaja,
  cerradaAt: string,
): VentaDelMedio["anulada"] {
  if (!venta.anulada) return "no";
  // Sin fecha de anulación no se sabe: se toma como anulada antes, igual que la vista hoy.
  if (!venta.anuladaAt) return "antes";
  return new Date(venta.anuladaAt) > new Date(cerradaAt) ? "despues" : "antes";
}

export function desgloseCierre(
  lineas: LineaCierre[],
  ventas: VentaDeCaja[],
  caja: {
    cerradaAt: string;
    fondo: number;
    ingresos: number;
    retiros: number;
  },
): Map<string, DesgloseMedio> {
  const netoCaja =
    centavos(caja.fondo) + centavos(caja.ingresos) - centavos(caja.retiros);
  let fondoAsignado = netoCaja === 0;
  const resultado = new Map<string, DesgloseMedio>();

  for (const linea of lineas) {
    const delMedio: VentaDelMedio[] = [];
    let ventasCent = 0;
    for (const venta of ventas) {
      const pagos = venta.pagos.filter(
        (p) => p.medioPagoId === linea.medioPagoId,
      );
      if (pagos.length === 0) continue;
      const montoCent = pagos.reduce((acc, p) => acc + centavos(p.monto), 0);
      const anulada = estadoAnulacion(venta, caja.cerradaAt);
      if (anulada !== "antes") ventasCent += montoCent;
      delMedio.push({
        id: venta.id,
        createdAt: venta.createdAt,
        cajero: venta.cajero,
        monto: montoCent / 100,
        combinado: venta.pagos.some((p) => p.medioPagoId !== linea.medioPagoId),
        anulada,
      });
    }
    delMedio.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    let resto = centavos(linea.esperado) - ventasCent;
    let detalleCaja: DesgloseMedio["caja"] = null;
    if (!fondoAsignado && resto === netoCaja) {
      fondoAsignado = true;
      resto = 0;
      detalleCaja = {
        fondo: caja.fondo,
        ingresos: caja.ingresos,
        retiros: caja.retiros,
      };
    }

    resultado.set(linea.medioPagoId, {
      ventas: delMedio,
      totalVentas: ventasCent / 100,
      caja: detalleCaja,
      sinDetalle: resto / 100,
    });
  }
  return resultado;
}
