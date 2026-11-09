import type { AppRoute, Rol } from "@/modules/auth";

export type SeccionAyuda =
  "mostrador" | "mercaderia" | "negocio" | "administracion";

export interface Guia {
  id: string;
  seccion: SeccionAyuda;
  titulo: string;
  resumen: string;
  // Palabras con las que alguien podría buscarla y que no están en el texto.
  palabras: readonly string[];
  // Pantalla donde se hace: el rol que no puede entrar ahí tampoco ve la guía.
  ruta: AppRoute;
  roles: readonly Rol[];
  pasos: readonly string[];
  nota?: string;
}

// Sin acentos ni mayúsculas: en el mostrador se escribe "anular" o "Efectivo" de cualquier forma.
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

// Una guía coincide si contiene todas las palabras buscadas, en cualquier orden.
export function buscarGuias(
  guias: readonly Guia[],
  busqueda: string,
): readonly Guia[] {
  const terminos = normalizar(busqueda).split(/\s+/).filter(Boolean);
  if (terminos.length === 0) return guias;

  return guias.filter((guia) => {
    const texto = normalizar(
      [
        guia.titulo,
        guia.resumen,
        ...guia.palabras,
        ...guia.pasos,
        guia.nota ?? "",
      ].join(" "),
    );
    return terminos.every((termino) => texto.includes(termino));
  });
}
