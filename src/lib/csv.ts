// Parser de CSV genérico y chico: soporta campos entre comillas (con comas y comillas
// escapadas `""` adentro) y saltos de línea CRLF o LF. No es RFC 4180 completo, pero
// alcanza para los CSV de productos que exporta una planilla común.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      pushField();
    } else if (char === "\r") {
      // se ignora; el \n que sigue cierra la fila
    } else if (char === "\n") {
      pushRow();
    } else {
      field += char;
    }
  }

  // última fila, si el archivo no termina con salto de línea
  if (field !== "" || row.length > 0) {
    pushRow();
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

// Convierte filas crudas (primera fila = encabezados) en objetos { encabezado: valor },
// recortando espacios en encabezados y valores.
export function csvRowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((h) => h.trim());

  return dataRows.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      obj[header] = (row[i] ?? "").trim();
    });
    return obj;
  });
}
