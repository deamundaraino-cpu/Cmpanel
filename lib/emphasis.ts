/** Marca la frase clave de un texto envolviéndola en **dobles asteriscos**. */
export function parseEmphasis(text: string): { text: string; strong: boolean }[] {
  return text
    .split(/\*\*(.+?)\*\*/g)
    .filter((part) => part.length > 0)
    .map((part, i) => ({ text: part, strong: i % 2 === 1 }));
}

/** Quita las marcas de énfasis para mostrar el texto tal cual (calendario, pipeline, guion copiado). */
export function stripEmphasis(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1");
}
