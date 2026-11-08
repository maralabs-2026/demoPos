"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import {
  cambiarActivoProveedor,
  crearProveedor,
  editarProveedor,
} from "../actions";
import type { Proveedor } from "../queries";
import { PROVEEDOR_NOMBRE_MAX, PROVEEDOR_NOTA_MAX } from "../schemas";

function ProveedorForm({
  proveedor,
  onListo,
}: {
  proveedor: Proveedor | null;
  onListo: () => void;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState(proveedor?.nombre ?? "");
  const [telefono, setTelefono] = useState(proveedor?.telefono ?? "");
  const [nota, setNota] = useState(proveedor?.nota ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const input = { nombre, telefono, nota };
      const result = proveedor
        ? await editarProveedor(proveedor.id, input)
        : await crearProveedor(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Proveedor guardado");
      router.refresh();
      onListo();
    });
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <DialogTitle>
          {proveedor ? "Editar proveedor" : "Nuevo proveedor"}
        </DialogTitle>
        <DialogDescription>
          El teléfono se usa para mandarle el pedido por WhatsApp.
        </DialogDescription>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Nombre
        <Input
          value={nombre}
          maxLength={PROVEEDOR_NOMBRE_MAX}
          autoFocus
          onChange={(e) => setNombre(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Teléfono (opcional)
        <Input
          inputMode="tel"
          placeholder="5493511234567"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Nota (opcional)
        <Input
          value={nota}
          maxLength={PROVEEDOR_NOTA_MAX}
          placeholder="Ej.: pasa los martes"
          onChange={(e) => setNota(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Guardando..." : "Guardá el proveedor"}
      </Button>
    </form>
  );
}

export function ProveedoresScreen({
  proveedores,
}: {
  proveedores: Proveedor[];
}) {
  const router = useRouter();
  const [formulario, setFormulario] = useState<Proveedor | "nuevo" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function alternar(proveedor: Proveedor) {
    setError(null);
    startTransition(async () => {
      const result = await cambiarActivoProveedor(
        proveedor.id,
        !proveedor.activo,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button onClick={() => setFormulario("nuevo")}>
          <Plus data-icon="inline-start" />
          Nuevo proveedor
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {proveedores.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no cargaste proveedores.
        </p>
      ) : (
        <Card className="gap-1 p-5">
          <ul aria-label="Proveedores" className="flex flex-col">
            {proveedores.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-2.5 text-sm last:border-0"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-semibold break-words">
                    {p.nombre}
                    {!p.activo && <Badge>Inactivo</Badge>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {[p.telefono, p.nota].filter(Boolean).join(" · ") ||
                      "Sin datos de contacto"}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFormulario(p)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => alternar(p)}
                  >
                    {p.activo ? "Desactivá" : "Activá"}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Dialog
        open={formulario !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setFormulario(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {formulario && (
            <ProveedorForm
              key={formulario === "nuevo" ? "nuevo" : formulario.id}
              proveedor={formulario === "nuevo" ? null : formulario}
              onListo={() => setFormulario(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
