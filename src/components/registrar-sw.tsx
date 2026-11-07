"use client";

import { useEffect } from "react";

// Registra public/sw.js, que deja abrir /vender aunque se recargue sin internet. Solo en
// producción: en desarrollo, una copia vieja de la pantalla confundiría al programar.
export function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    let cancelado = false;
    void (async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
        const registro = await navigator.serviceWorker.ready;
        if (cancelado || !registro.active) return;
        // La primera vez, esta página cargó antes que el service worker: le pasa los archivos que
        // ya usó para que también queden guardados.
        const archivos = performance
          .getEntriesByType("resource")
          .map((e) => e.name);
        registro.active.postMessage({
          tipo: "precargar",
          archivos,
          guardarVender: window.location.pathname === "/vender",
        });
      } catch {
        // Sin service worker la app funciona igual; solo no abre /vender recargando sin red.
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);
  return null;
}
