"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { cambiarActivoUsuario } from "../actions";
import type { Usuario } from "../queries";
import { ROL_LABELS, rolBadgeVariant } from "../roles";
import type { Rol } from "../session";
import {
  BlanquearDialog,
  CrearUsuarioDialog,
  EditarUsuarioDialog,
} from "./usuario-dialogs";

export function UsuariosScreen({
  usuarios,
  roles,
}: {
  usuarios: Usuario[];
  // Los roles que puede asignar quien mira. La RLS es la barrera real.
  roles: readonly Rol[];
}) {
  const router = useRouter();
  const [creando, setCreando] = useState(false);
  const [aEditar, setAEditar] = useState<Usuario | null>(null);
  const [aBlanquear, setABlanquear] = useState<Usuario | null>(null);
  const [aCambiar, setACambiar] = useState<Usuario | null>(null);

  async function confirmarCambio(usuario: Usuario) {
    const result = await cambiarActivoUsuario(usuario.id, !usuario.activo);
    if (!result.ok) {
      toast.error("No se pudo cambiar el usuario", result.error);
      return;
    }
    toast.success(
      usuario.activo ? "Usuario desactivado" : "Usuario reactivado",
      usuario.nombre,
    );
    router.refresh();
  }

  return (
    <>
      <Button className="self-start" onClick={() => setCreando(true)}>
        <Plus data-icon="inline-start" />
        Creá un usuario
      </Button>

      <Card className="gap-1 p-5">
        <ul aria-label="Usuarios" className="flex flex-col">
          {usuarios.map((usuario) => (
            <li
              key={usuario.id}
              className="flex flex-col gap-2 border-b border-border py-3 last:border-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p
                    className={
                      usuario.activo
                        ? "text-sm font-semibold break-words"
                        : "text-sm font-semibold break-words text-muted-foreground"
                    }
                  >
                    {usuario.nombre}
                  </p>
                  <p className="text-xs break-all text-muted-foreground">
                    {usuario.email}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant={rolBadgeVariant(usuario.rol)}>
                    {ROL_LABELS[usuario.rol]}
                  </Badge>
                  {!usuario.activo && (
                    <Badge variant="destructive">Desactivado</Badge>
                  )}
                  {usuario.activo && usuario.contrasenaTemporal && (
                    <Badge variant="warning">Contraseña temporal</Badge>
                  )}
                </div>
              </div>
              {usuario.administrable && (
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setACambiar(usuario)}
                  >
                    {usuario.activo ? "Desactivá" : "Reactivá"}
                  </Button>
                  {usuario.activo && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setABlanquear(usuario)}
                      >
                        Blanqueá
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAEditar(usuario)}
                      >
                        Editá
                      </Button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Dialog open={creando} onOpenChange={setCreando}>
        {creando && (
          <CrearUsuarioDialog roles={roles} onDone={() => setCreando(false)} />
        )}
      </Dialog>

      <Dialog
        open={aEditar !== null}
        onOpenChange={(open) => {
          if (!open) setAEditar(null);
        }}
      >
        {aEditar && (
          <EditarUsuarioDialog
            usuario={aEditar}
            roles={roles}
            onDone={() => setAEditar(null)}
          />
        )}
      </Dialog>

      <Dialog
        open={aBlanquear !== null}
        onOpenChange={(open) => {
          if (!open) setABlanquear(null);
        }}
      >
        {aBlanquear && (
          <BlanquearDialog
            usuario={aBlanquear}
            onDone={() => setABlanquear(null)}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={aCambiar !== null}
        onOpenChange={(open) => {
          if (!open) setACambiar(null);
        }}
        title={
          aCambiar?.activo
            ? "¿Desactivar el usuario?"
            : "¿Reactivar el usuario?"
        }
        description={
          aCambiar?.activo
            ? `${aCambiar.nombre} no va a poder ingresar. Sus ventas se conservan. Si tiene una caja abierta, cerrala desde Caja.`
            : `${aCambiar?.nombre ?? ""} va a poder ingresar de nuevo con su contraseña.`
        }
        confirmLabel={aCambiar?.activo ? "Desactivar" : "Reactivar"}
        destructive={aCambiar?.activo ?? false}
        onConfirm={() => {
          if (aCambiar) void confirmarCambio(aCambiar);
        }}
      />
    </>
  );
}
