// Rotación de familias de gancho. El error que no se puede repetir: la antigua
// instrucción de portadas enumeraba frases de muestra ("3 errores que…",
// "nadie te dice esto…") y el modelo devolvía esas mismas frases con las
// palabras cambiadas. Aquí se vigila que ninguna definición traiga ejemplos.
//
//   npx tsx scripts/test-angles.mjs

import { HOOK_FAMILIES, HOOK_BAR, pickHookFamilies, hookFamilyInstruction, familyById } from "../lib/angles.ts";
import { sanitizeCoverTexts, COVER_TEXTS_INSTRUCTION } from "../lib/proposalGen.ts";

let fallos = 0;
const ok = (cond, label, detalle = "") => {
  console.log(`${cond ? "PASA " : "FALLA"}  ${label}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallos++;
};

// —— Rotación ——
ok(HOOK_FAMILIES.length >= 7, "4a. hay familias suficientes para rotar", `${HOOK_FAMILIES.length}`);

const historial = [];
const elegidas = [];
for (let i = 0; i < HOOK_FAMILIES.length; i++) {
  const [f] = pickHookFamilies(historial, 1);
  elegidas.push(f.id);
  historial.unshift(f.id); // la más reciente va primero
}
ok(new Set(elegidas).size === HOOK_FAMILIES.length, `4b. ${HOOK_FAMILIES.length} llamadas seguidas no repiten familia`, elegidas.join(" → "));

const [a, b] = pickHookFamilies([], 2);
ok(a.id !== b.id, "4c. las dos variantes de un guion reciben familias distintas", `${a.id} / ${b.id}`);

const recientes = ["resultado_especifico", "opinion_impopular", "objecion_real"];
const siguientes = pickHookFamilies(recientes, 2).map((f) => f.id);
ok(!siguientes.some((id) => recientes.includes(id)), "4d. no reelige ninguna de las últimas usadas", siguientes.join(", "));
ok(pickHookFamilies([null, null], 1).length === 1, "4e. un histórico sin familia registrada no rompe la rotación");
ok(familyById("pov_realista")?.nombre === "POV realista", "4f. se puede recuperar una familia por su id");
ok(familyById("no_existe") === undefined, "4g. un id desconocido no inventa familia");

// —— Ninguna definición puede contener frases de muestra ——
for (const f of HOOK_FAMILIES) {
  const texto = `${f.objetivo} ${f.debeContener} ${f.descarta}`;
  const conComillas = /["“”]/.test(texto);
  ok(!conComillas, `4h. la familia "${f.nombre}" se describe por su función, sin frases de ejemplo`);
}
ok(!/["“”]/.test(HOOK_BAR), "4i. el listón de gancho tampoco dicta frases");
ok(!COVER_TEXTS_INSTRUCTION.includes("3 errores que"), "4j. la instrucción de portadas ya no trae el ejemplo de lista");
ok(!COVER_TEXTS_INSTRUCTION.includes("nadie te dice esto"), "4k. ni el de curiosidad");
ok(COVER_TEXTS_INSTRUCTION.includes("Ninguno puede empezar con las mismas palabras"), "4l. y exige variedad de apertura entre portadas");

// —— La instrucción que se inyecta ——
const instruccion = hookFamilyInstruction(HOOK_FAMILIES[0]);
ok(instruccion.includes("FAMILIA DE GANCHO PARA ESTA PIEZA"), "4m. la instrucción se identifica en el prompt");
ok(instruccion.includes("Cómo saber que fallaste"), "4n. incluye el criterio de descarte");
ok(instruccion.includes("primer segundo"), "4o. traslada la ventana real de retención");

// —— Portadas con la misma apertura ——
// Seis portadas donde tres empiezan igual: eso es lo que devolvía el modelo.
const portadas = sanitizeCoverTexts([
  "Tienes **siete propiedades** y una estructura vieja",
  "Tienes siete propiedades sin conectar",
  "Tienes siete propiedades y ningún diseño",
  "El **SII** mira el conjunto",
  "Qué firmaste en la **notaría**",
  "Antes de la **octava** compra",
]);
ok(portadas.length === 4, "4p. las portadas que repiten apertura se descartan", `${portadas.length} de 6`);
ok(portadas[0].includes("siete propiedades"), "4q. la primera de cada apertura se conserva");
ok(portadas.some((t) => t.includes("SII")) && portadas.some((t) => t.includes("octava")), "4r. las distintas se conservan todas");
ok(sanitizeCoverTexts(["**sin cerrar", "bien **cerrada**"]).length === 1, "4s. sigue descartando el énfasis mal formado");
ok(sanitizeCoverTexts("no es lista").length === 0, "4t. entrada inválida no rompe");

console.log(fallos ? `\n${fallos} test(s) fallando` : "\nTodos los tests pasan");
process.exit(fallos ? 1 : 0);
