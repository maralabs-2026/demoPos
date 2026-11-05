import { getUsuarios, requireRol, type Rol } from "@/modules/auth";
import { UsuariosScreen } from "@/modules/auth/components/usuarios-screen";

export const dynamic = "force-dynamic";

const ROLES_DUENO: readonly Rol[] = ["cajero", "encargado", "dueno"];
const ROLES_ENCARGADO: readonly Rol[] = ["cajero"];

export default async function UsuariosPage() {
  const profile = await requireRol("/usuarios");
  const usuarios = await getUsuarios();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">Usuarios</h1>
        <p className="text-sm text-muted-foreground">
          {profile.rol === "dueno"
            ? "El rol define lo que puede hacer cada uno. Un usuario no se borra: se desactiva."
            : "Podés administrar a los cajeros. Un usuario no se borra: se desactiva."}
        </p>
      </div>

      {!usuarios.ok && (
        <p className="text-sm text-destructive">{usuarios.error}</p>
      )}
      {usuarios.ok && (
        <UsuariosScreen
          usuarios={usuarios.data}
          roles={profile.rol === "dueno" ? ROLES_DUENO : ROLES_ENCARGADO}
        />
      )}
    </main>
  );
}
