"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { blanquearContrasena, crearUsuario, editarUsuario } from "../actions";
import { sugerirContrasena } from "../contrasena";
import type { Usuario } from "../queries";
import { ROL_LABELS } from "../roles";
import {
  blanquearContrasenaSchema,
  crearUsuarioSchema,
  editarUsuarioSchema,
  NOMBRE_USUARIO_MAX,
} from "../schemas";
import type { Rol } from "../session";

function Campo({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}

function SelectorRol({
  id,
  roles,
  value,
  onChange,
}: {
  id: string;
  roles: readonly Rol[];
  value: Rol;
  onChange: (rol: Rol) => void;
}) {
  return (
    <Campo id={id} label="Rol">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as Rol)}
        className="h-11 rounded-lg border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {roles.map((rol) => (
          <option key={rol} value={rol}>
            {ROL_LABELS[rol]}
          </option>
        ))}
      </select>
    </Campo>
  );
}

// Se ve en claro: quien la define se la tiene que pasar al usuario, que la cambia al ingresar.
function CampoContrasena({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (valor: string) => void;
}) {
  return (
    <Campo id={id} label="Contraseña temporal">
      <div className="flex gap-2">
        <Input
          id={id}
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange(sugerirContrasena())}
        >
          Generá una
        </Button>
      </div>
      <span className="text-xs text-muted-foreground">
        Pasásela al usuario. La va a cambiar en su primer ingreso.
      </span>
    </Campo>
  );
}

function ErrorForm({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <p role="alert" className="text-sm font-medium text-destructive">
      {mensaje}
    </p>
  );
}

export function CrearUsuarioDialog({
  roles,
  onDone,
}: {
  roles: readonly Rol[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Rol>("cajero");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;

    const parsed = crearUsuarioSchema.safeParse({
      nombre,
      email,
      rol,
      contrasena,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await crearUsuario(parsed.data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Usuario creado", parsed.data.email);
      onDone();
      router.refresh();
    });
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Creá un usuario</DialogTitle>
        <DialogDescription>
          Ingresa con su correo y la contraseña temporal que definas.
        </DialogDescription>
      </DialogHeader>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Campo id="usuario-nombre" label="Nombre">
          <Input
            id="usuario-nombre"
            autoComplete="off"
            maxLength={NOMBRE_USUARIO_MAX}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </Campo>
        <Campo id="usuario-email" label="Correo">
          <Input
            id="usuario-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Campo>
        <SelectorRol
          id="usuario-rol"
          roles={roles}
          value={rol}
          onChange={setRol}
        />
        <CampoContrasena
          id="usuario-contrasena"
          value={contrasena}
          onChange={setContrasena}
        />
        <ErrorForm mensaje={error} />
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Creando..." : "Creá el usuario"}
        </Button>
      </form>
    </DialogContent>
  );
}

export function EditarUsuarioDialog({
  usuario,
  roles,
  onDone,
}: {
  usuario: Usuario;
  roles: readonly Rol[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState(usuario.nombre);
  const [rol, setRol] = useState<Rol>(usuario.rol);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;

    const parsed = editarUsuarioSchema.safeParse({
      usuarioId: usuario.id,
      nombre,
      rol,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await editarUsuario(parsed.data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Usuario guardado", parsed.data.nombre);
      onDone();
      router.refresh();
    });
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Editá el usuario</DialogTitle>
        <DialogDescription>{usuario.email}</DialogDescription>
      </DialogHeader>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Campo id="editar-nombre" label="Nombre">
          <Input
            id="editar-nombre"
            autoComplete="off"
            maxLength={NOMBRE_USUARIO_MAX}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </Campo>
        <SelectorRol
          id="editar-rol"
          roles={roles}
          value={rol}
          onChange={setRol}
        />
        <ErrorForm mensaje={error} />
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardá los cambios"}
        </Button>
      </form>
    </DialogContent>
  );
}

export function BlanquearDialog({
  usuario,
  onDone,
}: {
  usuario: Usuario;
  onDone: () => void;
}) {
  const router = useRouter();
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;

    const parsed = blanquearContrasenaSchema.safeParse({
      usuarioId: usuario.id,
      contrasena,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await blanquearContrasena(parsed.data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Contraseña blanqueada", usuario.nombre);
      onDone();
      router.refresh();
    });
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Blanqueá la contraseña</DialogTitle>
        <DialogDescription>
          {usuario.nombre} deja de poder ingresar con la contraseña actual.
        </DialogDescription>
      </DialogHeader>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <CampoContrasena
          id="blanquear-contrasena"
          value={contrasena}
          onChange={setContrasena}
        />
        <ErrorForm mensaje={error} />
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Blanqueando..." : "Confirmá el blanqueo"}
        </Button>
      </form>
    </DialogContent>
  );
}
