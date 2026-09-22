import { describe, expect, it } from "vitest";
import { csvRowsToObjects, parseCsv } from "./csv";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with commas inside", () => {
    expect(parseCsv('nombre,precio\n"Arroz, 1kg",3000')).toEqual([
      ["nombre", "precio"],
      ["Arroz, 1kg", "3000"],
    ]);
  });

  it("handles escaped quotes inside a quoted field", () => {
    expect(parseCsv('nombre\n"Pan ""casero"""')).toEqual([
      ["nombre"],
      ['Pan "casero"'],
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("ignores a trailing blank line", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("csvRowsToObjects", () => {
  it("maps rows to objects keyed by trimmed header", () => {
    const rows = parseCsv(" nombre , precio \nCoca-Cola,2500");
    expect(csvRowsToObjects(rows)).toEqual([
      { nombre: "Coca-Cola", precio: "2500" },
    ]);
  });

  it("returns empty string for missing trailing columns", () => {
    const rows = parseCsv("nombre,precio,stock\nBic,900");
    expect(csvRowsToObjects(rows)).toEqual([
      { nombre: "Bic", precio: "900", stock: "" },
    ]);
  });
});
