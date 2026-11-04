import Image from "next/image";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

// Foto de un producto, o un ícono si no tiene. El nombre siempre está al lado, por eso la imagen es
// decorativa. Sin optimizar: la foto ya se achica antes de subirla.
// `entera` muestra el envase completo, sin recortarlo, para las fotos grandes de la venta.
export function FotoProducto({
  src,
  entera = false,
  className,
}: {
  src: string | null;
  entera?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-muted-foreground",
        entera && src && "bg-card",
        className,
      )}
    >
      {src ? (
        <Image
          unoptimized
          src={src}
          alt=""
          width={96}
          height={96}
          // Absoluta: si no, la altura sale de la foto y una vertical desborda la caja y se recorta.
          className={cn(
            "absolute inset-0 size-full",
            entera ? "object-contain" : "object-cover",
          )}
        />
      ) : (
        <Package
          aria-hidden="true"
          className={entera ? "size-10 opacity-60" : "size-1/2"}
        />
      )}
    </span>
  );
}
