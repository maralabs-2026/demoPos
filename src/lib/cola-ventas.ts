// Cola de ventas cobradas sin internet, guardada en el dispositivo (IndexedDB, sin librerías).
// Sobrevive a cerrar la pestaña y a reiniciar la PC. Cada venta tiene el id que generó la
// pantalla: enviarla de nuevo nunca la duplica (0028).
//
// "pendiente": falta enviarla. "rechazada": la base no la acepta (por ejemplo, la caja ya se
// cerró); queda a la vista hasta que alguien la resuelva a mano.

import type { Comprobante, VentaSinConexionInput } from "@/modules/ventas";

export type VentaEnCola = {
  venta: VentaSinConexionInput;
  comprobante: Comprobante;
  estado: "pendiente" | "rechazada";
  motivo?: string;
};

const DB = "pos-ventas";
const STORE = "cola";
// Avisa a las pantallas abiertas (venta, cierre de caja) que la cola cambió.
export const EVENTO_COLA = "pos:cola-ventas";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(DB, 1);
    pedido.onupgradeneeded = () => {
      pedido.result.createObjectStore(STORE, { keyPath: "venta.ventaId" });
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function operar<T>(
  modo: IDBTransactionMode,
  accion: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await abrir();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, modo);
      const pedido = accion(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(pedido.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function avisar() {
  window.dispatchEvent(new Event(EVENTO_COLA));
}

export async function guardarEnCola(
  venta: VentaSinConexionInput,
  comprobante: Comprobante,
): Promise<void> {
  const registro: VentaEnCola = { venta, comprobante, estado: "pendiente" };
  await operar("readwrite", (s) => s.put(registro));
  avisar();
}

// En el orden en que se cobraron: así se envían.
export async function leerCola(): Promise<VentaEnCola[]> {
  const todas = await operar<VentaEnCola[]>("readonly", (s) => s.getAll());
  return todas.sort((a, b) => a.venta.fecha.localeCompare(b.venta.fecha));
}

export async function quitarDeCola(ventaId: string): Promise<void> {
  await operar("readwrite", (s) => s.delete(ventaId));
  avisar();
}

export async function marcarRechazada(
  registro: VentaEnCola,
  motivo: string,
): Promise<void> {
  await operar("readwrite", (s) =>
    s.put({ ...registro, estado: "rechazada", motivo }),
  );
  avisar();
}

// Ventas de una caja que todavía no llegaron a la base: con alguna, la caja no se cierra.
export async function pendientesDeCaja(cajaId: string): Promise<number> {
  try {
    const cola = await leerCola();
    return cola.filter(
      (r) => r.estado === "pendiente" && r.venta.cajaId === cajaId,
    ).length;
  } catch {
    // Sin IndexedDB (navegador privado muy restringido) no pudo haber ventas en cola.
    return 0;
  }
}
