// Define las contraseñas de los usuarios de prueba de kiosko-demo-test y las guarda en
// .env.e2e.local, para correr Playwright. SOLO funciona contra la base de pruebas.
//
//   node scripts/e2e-set-passwords.mjs            # aplica los cambios
//   node scripts/e2e-set-passwords.mjs --dry-run  # solo muestra qué haría
//
// Usa el valor que ya tenga cada variable en .env.e2e.local; si está vacía, genera uno al azar.
// Para rotar una contraseña, vaciá su variable y volvé a correrlo. Nunca imprime las contraseñas.
// No toca must_change_password: el cajero sigue con la contraseña temporal que piden los tests.

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEST_PROJECT_REF = "nxpvhfyilruileakhldq"; // kiosko-demo-test
const ENV_FILE = ".env.e2e.local";
const REF_FILE = join("supabase", ".temp", "project-ref");
const USERS = [
  { key: "E2E_DUENO_PASSWORD", email: "dueno@kiosko.demo" },
  { key: "E2E_ENCARGADO_PASSWORD", email: "encargado@kiosko.demo" },
  { key: "E2E_CAJERO_PASSWORD", email: "cajero@kiosko.demo" },
];

const dryRun = process.argv.includes("--dry-run");

function abort(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function readVar(content, key) {
  const match = content.match(new RegExp(`^\\s*${key}\\s*=(.*)$`, "m"));
  return match ? match[1].trim() : "";
}

function setVar(content, key, value) {
  const line = new RegExp(`^\\s*${key}\\s*=.*$`, "m");
  if (line.test(content)) return content.replace(line, () => `${key}=${value}`);
  return `${content.replace(/\s*$/, "")}\n${key}=${value}\n`;
}

// Barreras: la CLI y el archivo tienen que apuntar los dos a la base de pruebas.
if (!existsSync(ENV_FILE))
  abort(`no existe ${ENV_FILE}. Corré el script desde la raíz del repo.`);
if (!existsSync(REF_FILE))
  abort("la CLI de Supabase no está linkeada a ningún proyecto.");
const linkedRef = readFileSync(REF_FILE, "utf8").trim();
if (linkedRef !== TEST_PROJECT_REF) {
  abort(
    `la CLI está linkeada a ${linkedRef}, no a kiosko-demo-test. No se cambió nada.`,
  );
}
let content = readFileSync(ENV_FILE, "utf8");
const url = readVar(content, "NEXT_PUBLIC_SUPABASE_URL");
if (url !== `https://${TEST_PROJECT_REF}.supabase.co`) {
  abort(
    `NEXT_PUBLIC_SUPABASE_URL de ${ENV_FILE} no es kiosko-demo-test. No se cambió nada.`,
  );
}

const users = USERS.map((user) => {
  const existing = readVar(content, user.key);
  return {
    ...user,
    reused: existing !== "",
    password: existing || randomBytes(18).toString("base64url"),
  };
});

for (const user of users) {
  console.log(
    `${user.email}: ${user.reused ? "usa el valor de" : "genera un valor para"} ${user.key}`,
  );
}
if (dryRun) {
  console.log("Simulación: no se cambió nada.");
  process.exit(0);
}

// Primero el archivo: si la base falla, volver a correrlo reutiliza los mismos valores.
for (const user of users) content = setVar(content, user.key, user.password);
writeFileSync(ENV_FILE, content);

const quote = (text) => `'${text.replace(/'/g, "''")}'`;
const values = users
  .map((u) => `(${quote(u.email)}, ${quote(u.password)})`)
  .join(",\n    ");
const sql = `with nuevas (email, password) as (
  values
    ${values}
), actualizados as (
  update auth.users u
     set encrypted_password = extensions.crypt(n.password, extensions.gen_salt('bf')),
         updated_at = now()
    from nuevas n
   where u.email = n.email
  returning u.email
)
select count(*)::int as actualizados from actualizados;
`;

// La consulta lleva las contraseñas: va en un archivo temporal, no en la línea de comandos.
const tempDir = mkdtempSync(join(tmpdir(), "e2e-passwords-"));
const sqlFile = join(tempDir, "update.sql");
try {
  writeFileSync(sqlFile, sql, { mode: 0o600 });
  const result = spawnSync(
    `npx --yes supabase db query --linked --yes -f "${sqlFile}"`,
    {
      shell: true,
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    throw new Error(
      "Supabase rechazó la actualización. Revisá tu sesión de la CLI.",
    );
  }

  const updated = JSON.parse(result.stdout).rows?.[0]?.actualizados;
  if (updated !== users.length) {
    throw new Error(
      `se actualizaron ${updated ?? 0} de ${users.length} usuarios. Revisá que existan en la base.`,
    );
  }
  console.log(
    `Listo: ${updated} usuarios actualizados en kiosko-demo-test y ${ENV_FILE} al día.`,
  );
} catch (error) {
  // Sin process.exit: el finally tiene que borrar el archivo con las contraseñas.
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
