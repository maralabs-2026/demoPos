"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/currency";
import type { ActionResult } from "@/lib/result";

const PUNTO_GUARDADO = "pos-mp-punto";
const CADA_MS = 3_000;

// Las acciones llegan por props desde la página: el módulo de ventas no importa el de pagos.
export type AccionesQr = {
  iniciar: (input: {
    puntoId: string;
    monto: number;
  }) => Promise<ActionResult<{ cobroId: string }>>;
  consultar: (
    id: string,
  ) => Promise<ActionResult<{ estado: string; orderId: string | null }>>;
  cancelar: (id: string) => Promise<ActionResult<null>>;
  confirmar: (id: string) => Promise<ActionResult<{ orderId: string }>>;
};

export type ConfigQr = {
  puntos: { id: string; nombre: string }[];
  acciones: AccionesQr;
};

type Fase =
  | "elegir"
  | "iniciando"
  | "esperando"
  | "confirmar"
  | "registrando"
  | "reintentar"
  | "fin";

function puntoRecordado(puntos: ConfigQr["puntos"]) {
  if (puntos.length === 1) return puntos[0].id;
  try {
    const id = localStorage.getItem(PUNTO_GUARDADO);
    return puntos.some((p) => p.id === id) ? id : null;
  } catch {
    return null;
  }
}

const FIN: Record<string, string> = {
  cancelado: "El cobro se canceló.",
  expirado: "El cobro venció sin pago.",
  error:
    "Lo pagado no coincide con el total. La venta no se registró: avisale al dueño.",
};

export function CobroQr({
  monto,
  config,
  onCobrado,
  onCerrar,
}: {
  monto: number;
  config: ConfigQr;
  // Devuelve el error si no se pudo registrar la venta; con null, la pantalla ya cerró el cobro.
  onCobrado: (orderId: string) => Promise<string | null>;
  onCerrar: () => void;
}) {
  const { puntos, acciones } = config;
  const [puntoId, setPuntoId] = useState(() => puntoRecordado(puntos));
  const [fase, setFase] = useState<Fase>(puntoId ? "iniciando" : "elegir");
  const [cobroId, setCobroId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const iniciado = useRef(false);
  const cobrado = useRef(false);

  const registrar = useRef<(orden: string) => Promise<void>>(async () => {});
  registrar.current = async (orden: string) => {
    setOrderId(orden);
    setMensaje(null);
    setFase("registrando");
    const error = await onCobrado(orden);
    if (error) {
      setMensaje(error);
      setFase("reintentar");
    }
  };

  useEffect(() => {
    if (fase !== "iniciando" || !puntoId || iniciado.current) return;
    iniciado.current = true;
    void acciones.iniciar({ puntoId, monto }).then((r) => {
      if (r.ok) {
        setCobroId(r.data.cobroId);
        setFase("esperando");
      } else {
        setMensaje(r.error);
        setFase("fin");
      }
    });
  }, [acciones, fase, monto, puntoId]);

  useEffect(() => {
    if (fase !== "esperando" && fase !== "confirmar") return;
    if (!cobroId) return;
    let activo = true;
    let timer: ReturnType<typeof setTimeout>;

    async function consultar(id: string) {
      const r = await acciones.consultar(id);
      if (!activo) return;
      if (r.ok && r.data.estado === "aprobado" && r.data.orderId) {
        if (!cobrado.current) {
          cobrado.current = true;
          void registrar.current(r.data.orderId);
        }
        return;
      }
      if (r.ok && FIN[r.data.estado]) {
        setMensaje(FIN[r.data.estado]);
        setFase("fin");
        return;
      }
      timer = setTimeout(() => void consultar(id), CADA_MS);
    }

    timer = setTimeout(() => void consultar(cobroId), CADA_MS);
    return () => {
      activo = false;
      clearTimeout(timer);
    };
  }, [acciones, cobroId, fase]);

  function elegir(id: string) {
    try {
      localStorage.setItem(PUNTO_GUARDADO, id);
    } catch {
      // Sin almacenamiento se vuelve a preguntar la próxima vez.
    }
    setPuntoId(id);
    setFase("iniciando");
  }

  async function cancelar() {
    if (!cobroId || ocupado) return;
    setOcupado(true);
    setMensaje(null);
    const r = await acciones.cancelar(cobroId);
    setOcupado(false);
    if (r.ok) onCerrar();
    else setMensaje(r.error);
  }

  async function confirmar() {
    if (!cobroId || ocupado || cobrado.current) return;
    setOcupado(true);
    setMensaje(null);
    const r = await acciones.confirmar(cobroId);
    setOcupado(false);
    if (r.ok) {
      cobrado.current = true;
      void registrar.current(r.data.orderId);
    } else {
      setMensaje(r.error);
    }
  }

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cobro con QR · {formatCurrency(monto)}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {fase === "elegir" && (
            <>
              <p className="text-sm">¿Con qué QR cobrás en este dispositivo?</p>
              {puntos.map((p) => (
                <Button
                  key={p.id}
                  variant="outline"
                  size="lg"
                  onClick={() => elegir(p.id)}
                >
                  {p.nombre}
                </Button>
              ))}
              <Button variant="ghost" onClick={onCerrar}>
                Volvé al ticket
              </Button>
            </>
          )}

          {fase === "iniciando" && (
            <p className="text-sm" role="status">
              Preparando el cobro…
            </p>
          )}

          {fase === "esperando" && (
            <>
              <p className="text-lg font-semibold" role="status">
                Esperando el pago…
              </p>
              <p className="text-sm text-muted-foreground">
                Pedile al cliente que escanee el QR del mostrador.
              </p>
              <Button
                variant="outline"
                size="lg"
                onClick={() => setFase("confirmar")}
              >
                Ya pagó
              </Button>
              <Button
                variant="ghost"
                disabled={ocupado}
                onClick={() => void cancelar()}
              >
                Cancelá el cobro
              </Button>
            </>
          )}

          {fase === "confirmar" && (
            <>
              <p className="text-sm">
                Revisá que el pago figure como aprobado en el celular del
                cliente. La venta va a quedar marcada para que la revise el
                dueño.
              </p>
              <Button
                size="lg"
                disabled={ocupado}
                onClick={() => void confirmar()}
              >
                Confirmá el pago a mano
              </Button>
              <Button variant="ghost" onClick={() => setFase("esperando")}>
                Seguí esperando
              </Button>
            </>
          )}

          {fase === "registrando" && (
            <p className="text-sm" role="status">
              Registrando la venta…
            </p>
          )}

          {fase === "reintentar" && orderId && (
            <>
              <p className="text-sm font-medium text-destructive" role="alert">
                El pago entró, pero la venta no se registró. {mensaje}
              </p>
              <Button size="lg" onClick={() => void registrar.current(orderId)}>
                Reintentá registrar la venta
              </Button>
              <Button variant="ghost" onClick={onCerrar}>
                Cerrá (el dueño lo va a ver en Inicio)
              </Button>
            </>
          )}

          {fase === "fin" && (
            <>
              <p className="text-sm" role="alert">
                {mensaje}
              </p>
              <Button size="lg" onClick={onCerrar}>
                Volvé al ticket
              </Button>
            </>
          )}

          {mensaje && (fase === "esperando" || fase === "confirmar") && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {mensaje}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
