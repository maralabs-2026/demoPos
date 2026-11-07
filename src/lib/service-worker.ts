// Puente con public/sw.js (bloque 3.2c). El nombre tiene que coincidir con PAGINAS en sw.js.
export const CACHE_PAGINAS = "pos-paginas";

// La copia de /vender tiene el catálogo y el nombre del usuario: se borra al cerrar sesión, así
// en un equipo compartido nadie ve la pantalla de otro.
export async function borrarPaginasGuardadas(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    await caches.delete(CACHE_PAGINAS);
  } catch {
    // Sin acceso a la caché (navegador privado): no había nada guardado.
  }
}
