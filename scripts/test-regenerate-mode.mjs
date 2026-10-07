// "Pedir cambios" se contradecía a sí mismo: el rol autorizaba reescribir el
// bloque completo y el mensaje siguiente reimponía la estructura y sus nombres,
// además de pegar el guion anterior como JSON crudo. Resultado: pedir otro
// gancho devolvía el mismo gancho maquillado.
//
//   npx tsx scripts/test-regenerate-mode.mjs

import { feedbackWantsRewrite, buildScriptRevisionPrompts } from "../lib/scriptPrompt.ts";
import { buildAvoidBlock } from "../lib/diversity.ts";
import { pieceToText } from "../lib/pastedPiece.ts";

let fallos = 0;
const ok = (cond, label, detalle = "") => {
  console.log(`${cond ? "PASA " : "FALLA"}  ${label}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallos++;
};

// —— Qué cuenta como cambio de fondo ——
const deFondo = [
  "dame otro gancho, este no me convence",
  "cambia el ángulo, está muy plano",
  "se parece mucho al guion anterior",
  "esto ya lo dijimos, suena igual",
  "reescríbelo desde cero",
  "empieza distinto, no con la misma frase",
  "el cierre es el mismo de siempre, quiero otro cierre",
];
for (const f of deFondo) ok(feedbackWantsRewrite(f), `7a. cambio de fondo: "${f.slice(0, 42)}…"`);

const retoques = [
  "cambia plusvalía por mayor valor",
  "acorta el body 2, es muy largo",
  "añade que la asesoría se agenda por el link en bio",
  "quita el emoji del final",
];
for (const f of retoques) ok(!feedbackWantsRewrite(f), `7b. retoque: "${f.slice(0, 42)}…"`);

// —— El guion anterior y su estructura ——
const beats = [
  { nombre: "Hook", guia: "Que no deslicen en el primer segundo." },
  { nombre: "Body", guia: "Primera pieza de valor." },
  { nombre: "CTA", guia: "Una sola acción." },
];
const guionPrevio = [
  { seccion: "Hook", texto: "**Tienes siete propiedades** y tu estructura sigue siendo la que armaste con dos.", edicion: "A cámara · ~4s" },
  { seccion: "Body", texto: "El contador revisa cada una por separado.", edicion: "B-roll · ~6s" },
  { seccion: "CTA", texto: "¿Cuántas propiedades tenías cuando se definió tu estructura actual?" },
];
const actual = pieceToText("guion_video", guionPrevio);
const evitar = buildAvoidBlock([{ gancho: guionPrevio[0].texto, cierre: guionPrevio[2].texto }]);
const base = { brief: "FICHA", ejemplos: "", actual, caption: "caption", beats, evitar };

// —— Modo reescritura ——
const rw = buildScriptRevisionPrompts({ ...base, feedback: "dame otro gancho, se parece al anterior", angulo: "\n\nFAMILIA_NUEVA" });
ok(rw.reescribe, "7c. el modo se detecta desde el feedback");
ok(!rw.user.includes("Respeta EXACTAMENTE"), "7d. desaparece la orden que anulaba el permiso de reescribir");
ok(rw.user.includes("puedes cambiarlo, fusionar bloques o renombrarlos"), "7e. la estructura entra como referencia, no como mandato");
ok(rw.user.includes("Tienes siete propiedades y tu estructura"), "7f. el gancho anterior entra en la lista de lo que hay que evitar");
ok(rw.user.includes("Cuántas propiedades tenías"), "7g. y el cierre anterior también");
ok(rw.user.includes("FAMILIA_NUEVA"), "7h. se rota a otra familia de gancho");
ok(rw.system.includes("reescribiendo de raíz lo que el feedback cuestiona"), "7i. el rol pide reescribir, sin mensajes contradictorios");
ok(rw.user.includes("No la retoques: reescríbela"), "7j. la versión anterior se marca como material a reescribir");

// —— Modo retoque ——
const tw = buildScriptRevisionPrompts({ ...base, feedback: "cambia plusvalía por mayor valor" });
ok(!tw.reescribe, "7k. un retoque no se confunde con un cambio de fondo");
ok(tw.user.includes("mantén este recorrido"), "7l. en retoque la estructura se conserva");
ok(tw.system.includes("sin perder lo que ya funciona"), "7m. y el rol pide conservar");
ok(!tw.user.includes("FAMILIA_NUEVA"), "7n. un retoque no cambia el ángulo de la pieza");

// —— El ancla que quedaba: el JSON crudo ——
for (const [modo, p] of [["reescritura", rw], ["retoque", tw]]) {
  // Solo el tramo anterior al FEEDBACK: más abajo el esquema de RESPUESTA sí
  // lleva la clave "seccion", y eso es correcto.
  const previo = p.user.slice(0, p.user.indexOf("FEEDBACK"));
  ok(!previo.includes('"seccion"'), `7o. ${modo}: el guion previo ya no viaja como JSON con sus claves`);
  ok(!p.user.includes('"edicion": "A cámara'), `7p. ${modo}: tampoco las notas de edición previas`);
  ok(p.user.includes("Hook:\n**Tienes siete propiedades**"), `7q. ${modo}: viaja como texto plano legible`);
}

// —— Sin estructura de origen ——
const sinEstructura = buildScriptRevisionPrompts({ ...base, beats: null, feedback: "otro gancho" });
ok(!sinEstructura.user.includes("Plan de intención"), "7r. una propuesta sin estructura no inventa una");

console.log(fallos ? `\n${fallos} test(s) fallando` : "\nTodos los tests pasan");
process.exit(fallos ? 1 : 0);
