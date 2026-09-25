export interface BrandParts {
  monogram: string;
  first: string;
  rest: string;
}

export function splitBrandName(comercioNombre: string): BrandParts {
  const words = comercioNombre.trim().split(/\s+/).filter(Boolean);
  const [first = "", ...restWords] = words;
  const monogram = first ? first.charAt(0).toUpperCase() : "";
  return { monogram, first, rest: restWords.join(" ") };
}