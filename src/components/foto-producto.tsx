import Image from "next/image";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

// Miniatura de un producto, o un ícono si no tiene foto. El nombre siempre está al lado, por eso
// la imagen es decorativa. Sin optimizar: la foto ya se achica antes de subirla.
export function FotoProducto({
  src,
  className,
}: {
  src: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-muted-foreground",
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
          className="size-full object-cover"
        />
      ) : (
        <Package aria-hidden="true" className="size-1/2" />
      )}
    </span>
  );
}
