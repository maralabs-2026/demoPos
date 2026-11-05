"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import {
  crearCategoria,
  eliminarCategoria,
  renombrarCategoria,
} from "../actions";
import { NombreDialog } from "./nombre-dialog";

type Categoria = { id: string; nombre: string };

export function CategoriasScreen({ categorias }: { categorias: Categoria[] }) {
  const router = useRouter();
  const [creando, setCreando] = useState(false);
  const [aRenombrar, setARenombrar] = useState<Categoria | null>(null);
  const [aEliminar, setAEliminar] = useState<Categoria | null>(null);

  async function confirmarEliminar(categoria: Categoria) {
    const result = await eliminarCategoria(categoria.id);
    if (!result.ok) {
      toast.error("No se pudo eliminar", result.error);
      return;
    }
    toast.success("Categoría eliminada", categoria.nombre);
    router.refresh();
  }

  return (
    <>
      <Button className="self-start" onClick={() => setCreando(true)}>
        <Plus data-icon="inline-start" />
        Agregá una categoría
      </Button>

      <Card className="gap-1 p-5">
        {categorias.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay categorías.
          </p>
        ) : (
          <ul aria-label="Categorías" className="flex flex-col">
            {categorias.map((categoria) => (
              <li
                key={categoria.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-3 last:border-0"
              >
                <p className="min-w-0 text-sm font-semibold break-words">
                  {categoria.nombre}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAEliminar(categoria)}
                  >
                    Eliminá
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setARenombrar(categoria)}
                  >
                    Renombrá
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={creando} onOpenChange={setCreando}>
        {creando && (
          <NombreDialog
            titulo="Agregá una categoría"
            boton="Guardá la categoría"
            onGuardar={async (nombre) => {
              const result = await crearCategoria({ nombre });
              if (result.ok) {
                toast.success("Categoría agregada", nombre.trim());
                setCreando(false);
                router.refresh();
              }
              return result;
            }}
          />
        )}
      </Dialog>

      <Dialog
        open={aRenombrar !== null}
        onOpenChange={(open) => {
          if (!open) setARenombrar(null);
        }}
      >
        {aRenombrar && (
          <NombreDialog
            titulo="Renombrá la categoría"
            boton="Guardá el nombre"
            inicial={aRenombrar.nombre}
            onGuardar={async (nombre) => {
              const result = await renombrarCategoria({
                id: aRenombrar.id,
                nombre,
              });
              if (result.ok) {
                toast.success("Categoría guardada", nombre.trim());
                setARenombrar(null);
                router.refresh();
              }
              return result;
            }}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={aEliminar !== null}
        onOpenChange={(open) => {
          if (!open) setAEliminar(null);
        }}
        title="¿Eliminar la categoría?"
        description={`"${aEliminar?.nombre ?? ""}" se elimina. Si tiene productos o promociones, no se va a poder.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (aEliminar) void confirmarEliminar(aEliminar);
        }}
      />
    </>
  );
}
