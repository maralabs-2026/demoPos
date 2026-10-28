"use client";

import { useMemo, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/currency";
import { csvRowsToObjects, parseCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { importarProductos } from "../actions";
import type { Categoria, Producto } from "../queries";
import {
  CSV_COLUMNAS,
  claveCategoria,
  validarCsvProductos,
  type FilaCsvValidada,
} from "../schemas";

type Archivo = {
  nombre: string;
  encabezados: string[];
  objetos: Record<string, string>[];
};

type FilaPreview =
  | (FilaCsvValidada & { ok: false })
  | {
      numero: number;
      ok: true;
      nombre: string;
      codigoBarras: string;
      categoria: string | null;
      precio: number;
      // Precio actual si el código ya está en el catálogo (la fila lo actualiza).
      precioActual: number | null;
    };

// Plantilla con los encabezados y un ejemplo, separada por coma. El BOM hace que Excel la abra
// como UTF-8 (si no, "Almacén" se ve mal); parseCsv lo descarta al leer.
const PLANTILLA = `data:text/csv;charset=utf-8,${encodeURIComponent(
  `﻿${CSV_COLUMNAS.join(",")}\n` +
    `"Yerba Playadito 1 kg",Almacén,7790387000013,"3100,00","4250,50",unidad,6\n`,
)}`;

export function CsvImport({
  productos,
  categorias,
}: {
  productos: Producto[];
  categorias: Categoria[];
}) {
  const router = useRouter();
  const [archivo, setArchivo] = useState<Archivo | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const preview = useMemo(() => {
    if (!archivo) return null;
    const validado = validarCsvProductos(archivo.objetos, archivo.encabezados);
    if (!validado.ok) return { ok: false as const, error: validado.error };

    const categoriasExistentes = new Set(
      categorias.map((c) => claveCategoria(c.nombre)),
    );
    const precioPorCodigo = new Map(
      productos.map((p) => [p.codigoBarras, p.precio]),
    );

    const filas: FilaPreview[] = validado.filas.map((fila) => {
      if (!fila.ok) return fila;
      const { producto } = fila;
      if (
        producto.categoria !== null &&
        !categoriasExistentes.has(claveCategoria(producto.categoria))
      ) {
        return {
          numero: fila.numero,
          ok: false,
          datos: archivo.objetos[fila.numero - 2],
          errores: [
            `La categoría "${producto.categoria}" no existe. Revisá cómo está escrita (con tildes) o dejala vacía.`,
          ],
        };
      }
      return {
        numero: fila.numero,
        ok: true,
        nombre: producto.nombre,
        codigoBarras: producto.codigoBarras,
        categoria: producto.categoria,
        precio: producto.precio,
        precioActual: precioPorCodigo.get(producto.codigoBarras) ?? null,
      };
    });

    const conError = filas.filter((f) => !f.ok).length;
    const actualiza = filas.filter(
      (f) => f.ok && f.precioActual !== null,
    ).length;
    return {
      ok: true as const,
      filas,
      conError,
      altas: filas.length - conError - actualiza,
      actualiza,
    };
  }, [archivo, categorias, productos]);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Se limpia el input para poder volver a elegir el mismo archivo después de corregirlo.
    e.target.value = "";
    if (!file) return;
    setError(null);
    setAviso(null);
    setErrorArchivo(null);

    const reader = new FileReader();
    reader.onload = () => {
      const filas = parseCsv(String(reader.result ?? ""));
      setArchivo({
        nombre: file.name,
        encabezados: (filas[0] ?? []).map((h) => h.trim()),
        objetos: csvRowsToObjects(filas),
      });
    };
    reader.onerror = () => {
      setArchivo(null);
      setErrorArchivo("No se pudo leer el archivo. Probá de nuevo.");
    };
    reader.readAsText(file, "utf-8");
  }

  function handleImport() {
    if (!archivo) return;
    setError(null);
    startTransition(async () => {
      const result = await importarProductos(
        archivo.objetos,
        archivo.encabezados,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const { creados, actualizados } = result.data;
      setArchivo(null);
      setAviso(
        `Listo: ${creados} ${creados === 1 ? "producto nuevo" : "productos nuevos"} y ${actualizados} ${
          actualizados === 1 ? "actualizado" : "actualizados"
        }.`,
      );
      router.refresh();
    });
  }

  const listo = preview?.ok && preview.conError === 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="csv-file" className="block text-sm font-medium">
          Archivo CSV
        </label>
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          disabled={isPending}
          className="file:border-input file:bg-background file:text-foreground block w-full text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm"
        />
        <p className="text-muted-foreground text-xs">
          Columnas: {CSV_COLUMNAS.join(", ")}. Separadas por coma o punto y
          coma; los montos pueden ir como 1.234,50. Costo y categoría pueden
          quedar vacíos.{" "}
          <a
            href={PLANTILLA}
            download="plantilla-productos.csv"
            className="underline underline-offset-2"
          >
            Descargá la plantilla
          </a>
          .
        </p>
      </div>

      {errorArchivo && (
        <p role="alert" className="text-destructive text-sm">
          {errorArchivo}
        </p>
      )}

      {archivo && preview && !preview.ok && (
        <p role="alert" className="text-destructive text-sm">
          {archivo.nombre}: {preview.error}
        </p>
      )}

      {archivo && preview?.ok && (
        <div className="space-y-3">
          <p className="text-sm">
            <span className="font-medium">{archivo.nombre}</span>:{" "}
            {preview.altas} {preview.altas === 1 ? "nuevo" : "nuevos"},{" "}
            {preview.actualiza} para actualizar
            {preview.conError > 0 && (
              <span className="text-destructive">
                {" "}
                y {preview.conError}{" "}
                {preview.conError === 1 ? "fila con error" : "filas con error"}.
                Corregí el archivo y volvé a elegirlo: no se importa nada hasta
                que esté todo bien.
              </span>
            )}
          </p>

          <div className="max-h-[28rem] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Fila</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="hidden sm:table-cell">Código</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.filas.map((fila) => (
                  <TableRow
                    key={fila.numero}
                    className={cn(!fila.ok && "bg-red-50 dark:bg-red-950/40")}
                  >
                    <TableCell className="tabular-nums">
                      {fila.numero}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {fila.ok ? fila.nombre : fila.datos.nombre || "—"}
                      {fila.ok && fila.categoria && (
                        <span className="text-muted-foreground block text-xs">
                          {fila.categoria}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden tabular-nums sm:table-cell">
                      {fila.ok
                        ? fila.codigoBarras
                        : fila.datos.codigo_barras || "—"}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      {fila.ok ? (
                        <>
                          {fila.precioActual !== null &&
                            fila.precioActual !== fila.precio && (
                              <span className="text-muted-foreground block text-xs line-through">
                                {formatCurrency(fila.precioActual)}
                              </span>
                            )}
                          {formatCurrency(fila.precio)}
                        </>
                      ) : (
                        fila.datos.precio || "—"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-normal text-sm">
                      {fila.ok ? (
                        fila.precioActual === null ? (
                          <span className="text-emerald-600">Nuevo</span>
                        ) : (
                          <span>Actualiza</span>
                        )
                      ) : (
                        <span className="text-destructive">
                          {fila.errores.join(" · ")}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {aviso && (
        <p role="status" className="text-sm text-emerald-600">
          {aviso}
        </p>
      )}

      {archivo && preview?.ok && (
        <Button
          type="button"
          size="lg"
          onClick={handleImport}
          disabled={isPending || !listo}
        >
          {isPending
            ? "Importando…"
            : `Importá ${preview.filas.length} ${
                preview.filas.length === 1 ? "producto" : "productos"
              }`}
        </Button>
      )}
    </div>
  );
}
