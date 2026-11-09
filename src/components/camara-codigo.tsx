"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  codigoDeLecturas,
  confirmarLectura,
  FORMATOS_CODIGO,
  mensajeErrorCamara,
  ZXING_WASM_PATH,
} from "@/lib/codigos";
import { cn } from "@/lib/utils";

type Detector = {
  detect: (
    fuente: HTMLVideoElement,
  ) => Promise<{ rawValue: string; format: string }[]>;
};

// El lector del navegador si existe (Chrome en Android); si no, el de barcode-detector, que se
// descarga recién acá, junto con su .wasm servido desde el propio sitio.
async function crearDetector(): Promise<Detector> {
  const nativo = (
    globalThis as {
      BarcodeDetector?: {
        new (opciones: { formats: string[] }): Detector;
        getSupportedFormats: () => Promise<string[]>;
      };
    }
  ).BarcodeDetector;
  if (nativo) {
    const soportados = await nativo
      .getSupportedFormats()
      .catch((): string[] => []);
    const formatos = FORMATOS_CODIGO.filter((f) => soportados.includes(f));
    if (formatos.length > 0) return new nativo({ formats: formatos });
  }

  const { BarcodeDetector, prepareZXingModule } =
    await import("barcode-detector/ponyfill");
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith(".wasm") ? ZXING_WASM_PATH : prefix + path,
    },
  });
  return new BarcodeDetector({ formats: [...FORMATOS_CODIGO] });
}

const INTERVALO_MS = 150;

export function CamaraCodigo({
  onCodigo,
  className,
}: {
  // Se llama una sola vez por apertura, con el código confirmado.
  onCodigo: (codigo: string) => void;
  className?: string;
}) {
  const [disponible, setDisponible] = useState(false);
  const [abierta, setAbierta] = useState(false);
  const [estado, setEstado] = useState<"iniciando" | "leyendo" | "error">(
    "iniciando",
  );
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodigoRef = useRef(onCodigo);
  useEffect(() => {
    onCodigoRef.current = onCodigo;
  }, [onCodigo]);

  // El botón aparece solo si el navegador puede usar una cámara.
  useEffect(() => {
    const medios = navigator.mediaDevices;
    if (!medios?.getUserMedia || !window.isSecureContext) return;
    medios
      .enumerateDevices()
      .then((dispositivos) =>
        setDisponible(dispositivos.some((d) => d.kind === "videoinput")),
      )
      .catch(() => setDisponible(false));
  }, []);

  const cerrar = useCallback(() => setAbierta(false), []);

  useEffect(() => {
    if (!abierta) return;
    let cancelado = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pendiente: string | null = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el estado refleja el arranque de la cámara, un sistema externo
    setEstado("iniciando");
    setError("");

    async function iniciar() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelado) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const detector = await crearDetector();
        if (cancelado) return;
        setEstado("leyendo");

        const leer = async () => {
          if (cancelado) return;
          try {
            if (video.readyState >= 2) {
              const codigo = codigoDeLecturas(await detector.detect(video));
              const r = confirmarLectura(pendiente, codigo);
              pendiente = r.pendiente;
              if (r.confirmado && !cancelado) {
                cancelado = true;
                navigator.vibrate?.(80);
                onCodigoRef.current(r.confirmado);
                setAbierta(false);
                return;
              }
            }
          } catch {
            // Un cuadro que no se pudo leer no corta la cámara.
          }
          timer = setTimeout(leer, INTERVALO_MS);
        };
        void leer();
      } catch (e) {
        if (cancelado) return;
        setEstado("error");
        setError(mensajeErrorCamara((e as { name?: string })?.name));
      }
    }
    void iniciar();

    // Al cerrar se apaga la cámara: la luz del celular no queda prendida.
    return () => {
      cancelado = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [abierta]);

  if (!disponible) return null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Leé el código con la cámara"
        className={cn("shrink-0", className)}
        onClick={() => setAbierta(true)}
      >
        <Camera aria-hidden="true" />
      </Button>
      <Dialog
        open={abierta}
        onOpenChange={(abrir) => {
          if (!abrir) cerrar();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Leé el código de barras</DialogTitle>
            <DialogDescription>
              Apuntá la cámara al código. Se carga solo cuando lo lee.
            </DialogDescription>
          </DialogHeader>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              muted
              playsInline
              aria-label="Vista de la cámara"
              className="size-full object-cover"
            />
            {estado === "leyendo" && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-destructive/80 shadow-[0_0_12px_rgba(239,68,68,0.8)]"
              />
            )}
            {estado === "iniciando" && (
              <p className="absolute inset-0 grid place-items-center text-sm text-white">
                Abriendo la cámara...
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <Button type="button" variant="outline" onClick={cerrar}>
            Cerrá la cámara
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
