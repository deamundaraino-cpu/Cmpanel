// Los prompts se componían dentro del route handler y no había forma de
// comprobarlos sin DB ni red. Ahora salen de lib/scriptPrompt.ts y
// lib/carouselPrompt.ts, y este test fija su contrato: qué entra, en qué orden
// y con qué separadores. Cualquier cambio en el prompt tiene que pasar por aquí.
//
//   npx tsx scripts/test-script-prompt.mjs

import { buildScriptPrompts, buildBeatsGuide } from "../lib/scriptPrompt.ts";
import { buildCarouselPrompts } from "../lib/carouselPrompt.ts";
import { sanitizeGuide, sectionRange, sectionCountViolations } from "../lib/scriptPrompt.ts";
import { normalizeBeats } from "../lib/proposalGen.ts";
import { parseBannedRules } from "../lib/brandRules.ts";
import { parseScript, pieceToText } from "../lib/pastedPiece.ts";

let fallos = 0;
const ok = (cond, label, detalle = "") => {
  console.log(`${cond ? "PASA " : "FALLA"}  ${label}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallos++;
};
/** a aparece antes que b (y ambos aparecen). */
const antesDe = (texto, a, b) => texto.includes(a) && texto.includes(b) && texto.indexOf(a) < texto.indexOf(b);

const beats = [
  { nombre: "Hook", guia: "Rompe el patrón de lo que están viendo." },
  { nombre: "Body 1", guia: "Primera pieza de valor real." },
  { nombre: "CTA", guia: "Lleva al siguiente paso." },
];
const script = buildScriptPrompts({
  brief: "FICHA_DE_MARCA",
  ejemplos: "\n\nBLOQUE_EJEMPLOS",
  contexto: "CONTEXTO_DE_ORIGEN",
  beats,
});

// —— System del guion ——
ok(script.system.startsWith("Eres un guionista experto"), "0a. el system abre con el rol del guionista");
ok(script.system.includes("\n\nFicha de marca:\nFICHA_DE_MARCA"), "0b. la ficha entra bajo su encabezado");
ok(script.system.endsWith("BLOQUE_EJEMPLOS"), "0c. los ejemplos van al final del system");

// —— User del guion: orden de los bloques ——
ok(script.user.startsWith("CONTEXTO_DE_ORIGEN"), "0d. el contexto de origen abre el user");
ok(
  buildBeatsGuide(beats) === "1. Hook: Rompe el patrón de lo que están viendo.\n2. Body 1: Primera pieza de valor real.\n3. CTA: Lleva al siguiente paso.",
  "0e. la guía numera las secciones con su intención"
);
ok(script.user.includes(buildBeatsGuide(beats)), "0f. la guía de secciones se inyecta entera");
ok(antesDe(script.user, "CONTEXTO_DE_ORIGEN", "1. Hook:"), "0g. contexto antes que estructura");
ok(antesDe(script.user, "1. Hook:", 'campo "edicion"'), "0h. estructura antes que las notas de edición");
ok(antesDe(script.user, 'Devuelve JSON:', "autoevalúa la pieza"), "0i. esquema JSON antes que el listón de calidad");
ok(antesDe(script.user, "autoevalúa la pieza", 'Escribe además "portadas"'), "0j. calidad antes que los textos de portada");
ok(script.user.includes("En el texto de la PRIMERA sección (el gancho inicial)"), "0k. el énfasis se pide por posición, no por nombre de sección");
ok(script.user.includes("10-15 hashtags."), "0l. pide 10-15 hashtags");

// —— Los tres candados que imponían el molde: ya no están ——
// La estructura entra como intención. Tres instrucciones distintas ordenaban
// rellenar casillas con nombres fijos y el modelo obedecía al pie de la letra.
ok(!script.user.includes("EXACTAMENTE esta estructura"), "0m. [candado 1] fuera la orden de seguir la estructura al pie de la letra");
ok(!script.user.includes('{"seccion": "Hook"'), "0n. [candado 2] el esquema JSON ya no precarga el nombre de la primera sección");
ok(!script.user.includes("Usa exactamente estos nombres de sección"), "0o. [candado 3] fuera la lista cerrada de nombres");

// —— Lo que los sustituye: intención con margen ——
ok(script.user.includes("PLAN DE INTENCIÓN"), "0m2. la estructura se presenta como plan de intención");
ok(script.user.includes("lo que tiene que CONSEGUIR cada bloque, no lo que tiene que decir"), "0n2. dice explícitamente objetivo, no guion");
ok(script.user.includes("renómbralos para que describan lo que de verdad pasa"), "0o2. autoriza renombrar las secciones");
ok(script.user.includes("fusionar dos bloques, o partir uno"), "0p2. autoriza fusionar o partir bloques");
ok(script.user.includes("entrega entre 3 y 4 secciones"), "0q2. el número de secciones es un rango sobre las 3 de la estructura");
ok(buildScriptPrompts({ brief: "F", ejemplos: "", contexto: "C", beats: [...beats, ...beats] }).user.includes("entrega entre 5 y 7 secciones"),
  "0r2. el rango se adapta al tamaño de la estructura");
ok(script.user.includes("sin dos puntos ni comas"), "0s2. pide nombres que el modo reemplazo pueda volver a leer");

// —— Bloque de evitación (Fase 2) ——
const conEvitar = buildScriptPrompts({
  brief: "FICHA_DE_MARCA",
  ejemplos: "",
  contexto: "CONTEXTO_DE_ORIGEN",
  beats,
  evitar: "\n\nYA_PUBLICADO",
});
ok(conEvitar.user.includes("YA_PUBLICADO"), "0u. el bloque de lo ya publicado entra en el user");
ok(antesDe(conEvitar.user, "el gancho inicial", "YA_PUBLICADO"), "0v. va pegado a la instrucción del gancho");
ok(antesDe(conEvitar.user, "YA_PUBLICADO", "Devuelve JSON:"), "0w. y antes del esquema JSON");
ok(!script.user.includes("YA_PUBLICADO") && script.user.length < conEvitar.user.length, "0x. sin histórico no añade nada");

// —— Carrusel ——
const carrusel = buildCarouselPrompts({
  brief: "FICHA_DE_MARCA",
  ejemplos: "",
  contexto: "CONTEXTO_DE_ORIGEN",
  coverLayouts: ["split", "marco"],
});
ok(carrusel.system.startsWith("Eres un creador de carruseles virales"), "0p. el system del carrusel abre con su rol");
ok(carrusel.system.endsWith("Ficha de marca:\nFICHA_DE_MARCA"), "0q. sin piezas aprobadas, el system termina en la ficha");
ok(carrusel.user.includes("Crea un carrusel de 6-7 slides."), "0r. pide 6-7 slides");
ok(carrusel.user.includes('"split"') && carrusel.user.includes('"marco"'), "0s. solo ofrece las composiciones de la marca");
ok(!carrusel.user.includes('"texto_detras"'), "0t. no ofrece composiciones que la marca no tiene");
const carrEvitar = buildCarouselPrompts({ brief: "F", ejemplos: "", contexto: "C", coverLayouts: ["split"], evitar: "\n\nYA_PUBLICADO" });
ok(antesDe(carrEvitar.user, "Crea un carrusel", "YA_PUBLICADO") && antesDe(carrEvitar.user, "YA_PUBLICADO", "Devuelve JSON:"), "0y. el carrusel también recibe lo ya publicado");

// —— Saneado de guías que contradicen a la marca ——
const reglas = parseBannedRules("[ESTILO]\ny curiosamente | Muletilla prohibida.\n/(que|lo que) nadie (dice|cuenta)/i | Muletilla prohibida.");
const saneadas = sanitizeGuide([
  { nombre: "Open Loop", guia: 'Crea más curiosidad para que sigan viendo. Ej: "eso no es lo más loco...", "y curiosamente..."' },
  { nombre: "Hook", guia: "Promete la lista. Anuncia que el último es el que nadie dice." },
  { nombre: "CTA", guia: "Una sola acción." },
], reglas);
ok(saneadas[0].guia === "Crea más curiosidad para que sigan viendo.", "3e. quita los ejemplos literales que la marca prohíbe", saneadas[0].guia);
ok(saneadas[1].guia === "Promete la lista.", "3f. si no basta, conserva solo las frases que cumplen", saneadas[1].guia);
ok(saneadas[2].guia === "Una sola acción.", "3g. lo que ya cumple no se toca");
ok(sanitizeGuide(saneadas, []).length === 3, "3h. sin lista de prohibidos no altera nada");

// —— Nombres de sección libres sin romper el modo reemplazo ——
const crudos = [
  { seccion: "Gancho: el dato duro", texto: "Primera frase." },
  { seccion: "Contexto, sin rodeos", texto: "Segunda frase." },
  { seccion: "", texto: "Tercera frase." },
  { seccion: "Cierre", texto: "   " },
];
const sanos = normalizeBeats(crudos, ["Hook", "Lead", "Body", "CTA"]);
ok(sanos.length === 3, "3i. descarta la sección sin texto hablado", `${sanos.length} secciones`);
ok(sanos[0].seccion === "Gancho el dato duro", "3j. quita los dos puntos del nombre", sanos[0].seccion);
ok(sanos[1].seccion === "Contexto sin rodeos", "3k. y las comas", sanos[1].seccion);
ok(sanos[2].seccion === "Body", "3l. sin nombre, usa el de la estructura en esa posición", sanos[2].seccion);
const ida = pieceToText("guion_video", sanos);
const vuelta = parseScript(ida, sanos);
ok(pieceToText("guion_video", vuelta) === ida, "3m. ida y vuelta del modo reemplazo intacta con nombres libres");
ok(vuelta.length === 3 && vuelta[0].texto === "Primera frase.", "3n. ningún bloque se pierde al reeditarlo a mano");
ok(normalizeBeats(undefined).length === 0 && normalizeBeats([]).length === 0, "3o. entrada vacía o inválida no rompe");
ok(normalizeBeats([{ seccion: "A".repeat(80), texto: "x" }])[0].seccion.length === 40, "3p. recorta nombres larguísimos a lo que admite el parser");

// —— El guion tiene que cerrar (Fase 3c: la flexibilidad no puede dejarlo a medias) ——
// Caso real: con una estructura de 6 bloques el modelo devolvió 4 y terminó en
// "puente", dejando la pieza sin cierre.
const rango = sectionRange(beats);
ok(rango.min === 3 && rango.max === 4, "3q. el rango sale de la estructura", `${rango.min}-${rango.max}`);
const seis = sectionRange([...beats, ...beats]);
const corto = sectionCountViolations({ beats: [1, 2, 3, 4].map((n) => ({ texto: `s${n}` })) }, seis);
ok(corto.length === 1 && corto[0].level === "estilo", "3r. 4 secciones donde el plan pide 5 se marca", corto[0]?.label);
ok((corto[0]?.explain || "").includes("CERRAR la pieza"), "3s. y se le explica al modelo que falta el cierre");
ok(sectionCountViolations({ beats: [1, 2, 3, 4, 5].map((n) => ({ texto: `s${n}` })) }, seis).length === 0, "3t. dentro del rango no se marca nada");
ok(sectionCountViolations({ beats: new Array(9).fill({ texto: "x" }) }, seis)[0]?.label.includes("sobrado"), "3u. pasarse también se marca");
ok(sectionCountViolations({ beats: [] }, seis).length === 0, "3v. una respuesta vacía la gestiona el route, no este chequeo");
ok(sectionCountViolations({}, seis).length === 0, "3w. entrada sin beats no rompe");

console.log(fallos ? `\n${fallos} test(s) fallando` : "\nTodos los tests pasan");
process.exit(fallos ? 1 : 0);
