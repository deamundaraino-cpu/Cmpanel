// Modo reemplazo: el editor pega la versión final y se guarda tal cual, sin
// pasar por el modelo. Solo se traduce el texto plano a la estructura que ya
// usa la propuesta (slides o secciones), respetando el contenido carácter a
// carácter.

export type Slide = { titulo: string; cuerpo: string; layout?: string; foto?: string; portadas?: string[] };
export type Beat = { seccion: string; texto: string; edicion?: string; portadas?: string[] };

/** Bloques separados por una línea en blanco. */
function splitBlocks(texto: string): string[] {
  return texto
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
}

/**
 * Carrusel: un bloque por slide; la primera línea es el título y el resto, el
 * cuerpo. Se conservan la composición y la foto elegidas de la portada.
 */
export function parseCarousel(texto: string, previous: Slide[]): Slide[] {
  return splitBlocks(texto).map((block, i) => {
    const [titulo, ...resto] = block.split("\n");
    const anterior = previous[i];
    return {
      titulo: titulo.trim(),
      cuerpo: resto.join("\n").trim(),
      ...(i === 0 && anterior?.layout ? { layout: anterior.layout } : {}),
      ...(i === 0 && anterior?.foto ? { foto: anterior.foto } : {}),
      ...(i === 0 && anterior?.portadas ? { portadas: anterior.portadas } : {}),
    };
  });
}

/**
 * Guion: un bloque por sección. Si el bloque empieza por "NOMBRE:" ese es el
 * nombre; si no, se mantiene el de la sección que ocupaba esa posición. Las
 * notas de edición y los textos de portada previos se conservan.
 */
export function parseScript(texto: string, previous: Beat[]): Beat[] {
  return splitBlocks(texto).map((block, i) => {
    const anterior = previous[i];
    const m = block.match(/^([\p{Lu}\p{L} 0-9º·/()-]{2,40}):\s*\n?([\s\S]*)$/u);
    const seccion = (m ? m[1].trim() : anterior?.seccion) || `Sección ${i + 1}`;
    const texto_ = (m ? m[2] : block).trim();
    return {
      seccion,
      texto: texto_,
      ...(anterior?.edicion ? { edicion: anterior.edicion } : {}),
      ...(i === 0 && anterior?.portadas ? { portadas: anterior.portadas } : {}),
    };
  });
}

/** Texto editable a partir de la pieza guardada (para precargar el editor). */
export function pieceToText(formato: string, items: (Slide & Beat)[]): string {
  if (formato === "guion_video") {
    return items.map((b) => `${b.seccion}:\n${b.texto}`).join("\n\n");
  }
  return items.map((s) => [s.titulo, s.cuerpo].filter(Boolean).join("\n")).join("\n\n");
}
