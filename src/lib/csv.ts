// Excel en es-AR exporta con punto y coma (la coma es el separador decimal). Se elige el
// separador que más aparece en la primera línea, fuera de comillas.
export function detectDelimiter(text: string): "," | ";" {
  let commas = 0;
  let semicolons = 0;
  let inQuotes = false;
  for (const char of text) {
    if (char === '"') inQuotes = !inQuotes;
    else if (inQuotes) continue;
    else if (char === "\n") break;
    else if (char === ",") commas++;
    else if (char === ";") semicolons++;
  }
  return semicolons > commas ? ";" : ",";
}

// Parser de CSV genérico y chico: soporta campos entre comillas (con separadores y comillas
// escapadas `""` adentro) y saltos de línea CRLF o LF. No es RFC 4180 completo, pero
// alcanza para los CSV de productos que exporta una planilla común.
export function parseCsv(
  text: string,
  delimiter: "," | ";" = detectDelimiter(text),
): string[][] {
  // El BOM que agrega Excel al guardar como "CSV UTF-8" ensucia el primer encabezado.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
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
    } else if (char === delimiter) {
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
