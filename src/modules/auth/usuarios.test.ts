import { describe, expect, it } from "vitest";
import { LARGO_CONTRASENA_SUGERIDA, sugerirContrasena } from "./contrasena";
import {
  blanquearContrasenaSchema,
  crearUsuarioSchema,
  editarUsuarioSchema,
  NOMBRE_USUARIO_MAX,
} from "./schemas";

const ID = "7d3f9a52-1c64-4b8e-9f21-3a5c7e9d1b20";
const NUEVO = {
  nombre: "  Juana  ",
  email: "  JUANA@Correo.com ",
  rol: "cajero",
  contrasena: "temporal-123",
};

describe("crearUsuarioSchema", () => {
  it("normaliza nombre y correo", () => {
    const parsed = crearUsuarioSchema.parse(NUEVO);
    expect(parsed.nombre).toBe("Juana");
    expect(parsed.email).toBe("juana@correo.com");
  });

  it.each([
    ["nombre vacío", { nombre: "   " }],
    ["nombre largo", { nombre: "x".repeat(NOMBRE_USUARIO_MAX + 1) }],
    ["correo inválido", { email: "juana" }],
    ["rol desconocido", { rol: "admin" }],
    ["contraseña corta", { contrasena: "corta" }],
    ["contraseña larga", { contrasena: "x".repeat(129) }],
  ])("rechaza %s", (_, cambio) => {
    expect(crearUsuarioSchema.safeParse({ ...NUEVO, ...cambio }).success).toBe(
      false,
    );
  });
});

describe("editarUsuarioSchema y blanquearContrasenaSchema", () => {
  it("exigen un usuario válido", () => {
    expect(
      editarUsuarioSchema.safeParse({
        usuarioId: "x",
        nombre: "Juana",
        rol: "cajero",
      }).success,
    ).toBe(false);
    expect(
      blanquearContrasenaSchema.safeParse({
        usuarioId: ID,
        contrasena: "temporal-123",
      }).success,
    ).toBe(true);
  });
});

describe("sugerirContrasena", () => {
  it("cumple el largo, no repite y evita caracteres confusos", () => {
    const a = sugerirContrasena();
    expect(a).toHaveLength(LARGO_CONTRASENA_SUGERIDA);
    expect(a).not.toMatch(/[0O1lI]/);
    expect(sugerirContrasena()).not.toBe(a);
    expect(
      crearUsuarioSchema.safeParse({ ...NUEVO, contrasena: a }).success,
    ).toBe(true);
  });
});
