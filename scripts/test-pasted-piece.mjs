// Test del modo reemplazo: lo que se pega se guarda idéntico, sin pasar por el
// modelo, y la ida y vuelta (texto → estructura → texto) no altera un carácter.
//
//   npx tsx scripts/test-pasted-piece.mjs

import { parseCarousel, parseScript, pieceToText } from "../lib/pastedPiece.ts";

let fallos = 0;
const ok = (cond, label, detalle = "") => {
  console.log(`${cond ? "PASA " : "FALLA"}  ${label}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallos++;
};

// 8a. Carrusel: el texto pegado se guarda tal cual.
const carruselTexto = `Tu estructura es la que armaste con **dos propiedades**
El portafolio creció y el diseño se quedó en la etapa anterior.

Qué mira el **SII**
Revisa cómo se relacionan propiedades, sociedades y contratos de arriendo.

El siguiente paso
Agenda tu Asesoría de Arquitectura.`;

const slides = parseCarousel(carruselTexto, [{ titulo: "viejo", cuerpo: "viejo", layout: "marco", foto: "abc123" }]);
ok(slides.length === 3, "8a. carrusel: 3 bloques → 3 slides", `${slides.length} slides`);
ok(slides[0].titulo === "Tu estructura es la que armaste con **dos propiedades**", "8b. título literal, con sus asteriscos");
ok(slides[1].cuerpo === "Revisa cómo se relacionan propiedades, sociedades y contratos de arriendo.", "8c. cuerpo literal");
ok(slides[0].layout === "marco" && slides[0].foto === "abc123", "8d. conserva composición y foto de la portada");
ok(pieceToText("carrusel", slides) === carruselTexto, "8e. ida y vuelta sin cambios (carrusel)");

// 8f. Guion: respeta nombres de sección y texto hablado.
const guionTexto = `HOOK:
Tienes siete propiedades. Tu estructura es la que armaste con dos.

PUNTO FINAL:
Nadie diseñó cómo se conectan entre sí.

CTA:
¿Cuántas propiedades tenías cuando se definió tu estructura actual?`;

const beats = parseScript(guionTexto, [
  { seccion: "Hook", texto: "viejo", edicion: "A cámara · ~4s" },
  { seccion: "Punto final", texto: "viejo", edicion: "Plano medio · ~6s" },
  { seccion: "CTA", texto: "viejo" },
]);
ok(beats.length === 3, "8f. guion: 3 bloques → 3 secciones", `${beats.length} secciones`);
ok(beats[0].seccion === "HOOK" && beats[0].texto === "Tienes siete propiedades. Tu estructura es la que armaste con dos.", "8g. sección y texto literales");
ok(beats[1].edicion === "Plano medio · ~6s", "8h. conserva las notas de edición previas");
ok(pieceToText("guion_video", beats) === guionTexto, "8i. ida y vuelta sin cambios (guion)");

// 8j. Sin encabezado de sección, mantiene el nombre de la posición.
const sinEncabezado = parseScript("Texto suelto sin nombre de sección.", [{ seccion: "Hook", texto: "viejo" }]);
ok(sinEncabezado[0].seccion === "Hook" && sinEncabezado[0].texto === "Texto suelto sin nombre de sección.", "8j. sin encabezado conserva el nombre anterior");

console.log(fallos ? `\n${fallos} test(s) fallando` : "\nTodos los tests pasan");
process.exit(fallos ? 1 : 0);
