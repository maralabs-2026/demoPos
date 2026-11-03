import { FOTO_TIPO, medidasFoto } from "./schemas";

const FOTO_CALIDAD = 0.8;

// Corre en el navegador: una foto de celular pesa varios MB y en el mostrador solo se ve chica.
// Siempre sale JPEG, el único formato que todos los navegadores pueden generar desde un canvas.
export async function achicarFoto(archivo: File): Promise<Blob> {
  const imagen = await createImageBitmap(archivo);
  try {
    const { ancho, alto } = medidasFoto(imagen.width, imagen.height);
    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const contexto = canvas.getContext("2d");
    if (!contexto) throw new Error("Canvas no disponible");

    // JPEG no tiene transparencia: sin fondo blanco, un PNG transparente saldría negro.
    contexto.fillStyle = "#ffffff";
    contexto.fillRect(0, 0, ancho, alto);
    contexto.drawImage(imagen, 0, 0, ancho, alto);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Imagen vacía"))),
        FOTO_TIPO,
        FOTO_CALIDAD,
      );
    });
  } finally {
    imagen.close();
  }
}
