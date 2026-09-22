"use client";

import { useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { csvRowsToObjects, parseCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { csvProductoRowSchema } from "../schemas";

type FilaPreview = {
  numero: number;
  datos: Record<string, string>;
  errores: string[];
};

const COLUMNAS_ESPERADAS =
  "nombre, categoria, codigo_barras, costo, precio, unidad_venta, stock_minimo";

export function CsvImportPreview() {
  const [filas, setFilas] = useState<FilaPreview[] | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNombreArchivo(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const texto = String(reader.result ?? "");
      const objetos = csvRowsToObjects(parseCsv(texto));

      const preview: FilaPreview[] = objetos.map((datos, i) => {
        const resultado = csvProductoRowSchema.safeParse(datos);
        const errores = resultado.success
          ? []
          : resultado.error.issues.map(
              (issue) => `${issue.path.join(".")}: ${issue.message}`,
            );
        return { numero: i + 1, datos, errores };
      });
      setFilas(preview);
    };
    reader.readAsText(file, "utf-8");
    // Se limpia el input para poder volver a elegir el mismo archivo si se corrige y reintenta.
    e.target.value = "";
  }

  const validas = filas?.filter((f) => f.errores.length === 0).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="csv-file" className="text-sm font-medium">
          Archivo CSV
        </label>
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="text-sm"
        />
        <p className="text-muted-foreground text-xs">
          Columnas esperadas: {COLUMNAS_ESPERADAS}
        </p>
      </div>

      {filas && (
        <div className="space-y-2">
          <p className="text-sm">
            <span className="font-medium">{nombreArchivo}</span>: {validas} de{" "}
            {filas.length} filas válidas.
          </p>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((fila) => (
                  <TableRow
                    key={fila.numero}
                    className={cn(
                      fila.errores.length > 0 && "bg-red-50 dark:bg-red-950/40",
                    )}
                  >
                    <TableCell>{fila.numero}</TableCell>
                    <TableCell>{fila.datos.nombre || "—"}</TableCell>
                    <TableCell>{fila.datos.categoria || "—"}</TableCell>
                    <TableCell>{fila.datos.codigo_barras || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fila.datos.precio || "—"}
                    </TableCell>
                    <TableCell>
                      {fila.errores.length === 0 ? (
                        <span className="text-sm text-green-700 dark:text-green-400">
                          OK
                        </span>
                      ) : (
                        <span className="text-destructive text-sm">
                          {fila.errores.join("; ")}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* TODO(fase-3): importación real (insertar/actualizar productos) en la semana 2,
              una vez que el login (Fase 2) permita ejecutar la escritura con el rol correcto. */}
          <Button
            type="button"
            disabled
            title="Disponible cuando esté conectado el login"
          >
            Importar {validas} productos
          </Button>
        </div>
      )}
    </div>
  );
}
