"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { enviarVentaSinConexion } from "../actions";
import {
  EVENTO_COLA,
  leerCola,
  marcarRechazada,
  quitarDeCola,
  type VentaEnCola,
} from "@/lib/cola-ventas";

// Cada cuánto se reintenta enviar la cola mientras haya algo pendiente.
const REINTENTO_MS = 30_000;

// Mantiene la cola al día y envía las ventas de esta caja, en el orden en que se cobraron.
// Un rechazo definitivo queda a la vista; un error de red corta la vuelta y se reintenta después.
function useColaVentas(cajaId: string) {
  const [cola, setCola] = useState<VentaEnCola[]>([]);
  const [enLinea, setEnLinea] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const ocupado = useRef(false);

  const refrescar = useCallback(async () => {
    try {
      setCola(await leerCola());
    } catch {
      setCola([]);
    }
  }, []);

  const enviar = useCallback(async () => {
    if (ocupado.current || !navigator.onLine) return;
    ocupado.current = true;
    setEnviando(true);
    try {
      const pendientes = (await leerCola()).filter(
        (r) => r.estado === "pendiente" && r.venta.cajaId === cajaId,
      );
      for (const registro of pendientes) {
        let result;
        try {
          result = await enviarVentaSinConexion(registro.venta);
        } catch {
          break; // sin red: se reintenta en la próxima vuelta
        }
        if (!result.ok) break;
        if (result.data.estado === "registrada") {
          await quitarDeCola(registro.venta.ventaId);
        } else {
          await marcarRechazada(registro, result.data.motivo);
        }
      }
    } catch {
      // IndexedDB no disponible: no hay nada que enviar.
    } finally {
      ocupado.current = false;
      setEnviando(false);
      await refrescar();
    }
  }, [cajaId, refrescar]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- navigator.onLine no existe en el servidor
    setEnLinea(navigator.onLine);
    void refrescar().then(enviar);
    const alVolver = () => {
      setEnLinea(true);
      void enviar();
    };
    const alCortarse = () => setEnLinea(false);
    const alCambiar = () => void refrescar();
    window.addEventListener("online", alVolver);
    window.addEventListener("offline", alCortarse);
    window.addEventListener(EVENTO_COLA, alCambiar);
    const intervalo = window.setInterval(() => void enviar(), REINTENTO_MS);
    return () => {
      window.removeEventListener("online", alVolver);
      window.removeEventListener("offline", alCortarse);
      window.removeEventListener(EVENTO_COLA, alCambiar);
      window.clearInterval(intervalo);
    };
  }, [enviar, refrescar]);

  return { cola, enLinea, enviando, enviar };
}

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Cordoba",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AvisoSinConexion({
  cajaId,
  className,
}: {
  cajaId: string;
  className?: string;
}) {
  const { cola, enLinea, enviando, enviar } = useColaVentas(cajaId);
  const pendientes = cola.filter(
    (r) => r.estado === "pendiente" && r.venta.cajaId === cajaId,
  );
  const rechazadas = cola.filter((r) => r.estado === "rechazada");

  if (enLinea && pendientes.length === 0 && rechazadas.length === 0) {
    return null;
  }

  const porEnviar =
    pendientes.length === 1
      ? "1 venta por enviar"
      : `${pendientes.length} ventas por enviar`;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {(!enLinea || pendientes.length > 0) && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-warning/40 bg-warning-soft px-4 py-2.5 text-sm text-warning-foreground"
        >
          <CloudOff aria-hidden="true" className="size-4 shrink-0" />
          <p className="min-w-0 flex-1">
            <span className="font-semibold">
              {enLinea ? "Volvió la conexión" : "Sin conexión"}
            </span>
            {" · "}
            {pendientes.length > 0
              ? enLinea
                ? `${porEnviar}${enviando ? ", enviando…" : ""}`
                : `${porEnviar}. Seguí cobrando: se envían solas cuando vuelva internet.`
              : "Seguí cobrando: las ventas se guardan en este dispositivo."}
          </p>
          {enLinea && pendientes.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              disabled={enviando}
              onClick={() => void enviar()}
            >
              <RefreshCw data-icon="inline-start" />
              Enviá ahora
            </Button>
          )}
        </div>
      )}

      {rechazadas.map((r) => (
        <div
          key={r.venta.ventaId}
          role="alert"
          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm"
        >
          <TriangleAlert
            aria-hidden="true"
            className="size-4 shrink-0 text-destructive"
          />
          <p className="min-w-0 flex-1">
            <span className="font-semibold">
              La venta de {formatCurrency(r.comprobante.total)} de las{" "}
              {hora(r.venta.fecha)} no se pudo registrar.
            </span>{" "}
            {r.motivo} Se cobró sin conexión: avisale al dueño para que la
            cargue a mano.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void quitarDeCola(r.venta.ventaId)}
          >
            Ya lo resolví
          </Button>
        </div>
      ))}
    </div>
  );
}
