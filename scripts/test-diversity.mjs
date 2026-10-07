// Los cuatro guiones que motivaron el rediseño: tres abren con las mismas tres
// palabras y tres cierran con la misma pregunta cambiando solo la cola. Este
// test usa esos textos tal cual salieron.
//
//   npx tsx scripts/test-diversity.mjs

import { openerKey, similarity, repetitionViolations, buildAvoidBlock, piecePoles } from "../lib/diversity.ts";

let fallos = 0;
const ok = (cond, label, detalle = "") => {
  console.log(`${cond ? "PASA " : "FALLA"}  ${label}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallos++;
};

// —— Textos reales (GOEASY, propuestas 65-69) ——
const H65 = "**Tienes siete propiedades** y tu estructura sigue siendo la que armaste con dos.";
const H66 = "Tienes siete propiedades y sigues declarando cada una por separado. Llevas años así y ahora estás por comprar la octava.";
const H67 = "**Heredar todo a nombre personal**. Tienes siete propiedades y crees que dejarlas así es la forma más simple.";
const H68 = "Tienes siete propiedades y nunca revisaste la **conexión entre activos**.";
const C65 = "¿Cuántas propiedades tenías cuando se definió tu estructura actual?";
const C66 = "¿Cuántas propiedades tenías cuando se definió tu forma actual de declarar?";
const C67 = "¿Cuántas propiedades tenías cuando se definió la forma en que las tienes a nombre personal?";
const C68 = "Reserva tu Asesoría de Arquitectura, link en bio.";

const guion = (gancho, cierre) => ({ beats: [{ texto: gancho }, { texto: "cuerpo" }, { texto: cierre }] });
const previa = (gancho, cierre) => ({ gancho, cierre });
const etiquetas = (v) => v.map((x) => x.label);

// —— Ganchos ——
ok(openerKey(H65) === "tienes siete propiedades", "2a. la huella ignora el énfasis y las tildes", openerKey(H65));
ok(openerKey(H65) === openerKey(H66) && openerKey(H65) === openerKey(H68), "2b. #66 y #68 comparten huella con #65");

const v66 = repetitionViolations(guion(H66, "otro cierre distinto del anterior"), [previa(H65, C65)]);
ok(etiquetas(v66).includes("Gancho repetido"), "2c. #66 marca gancho repetido contra #65");

// #67 abre con otra frase, pero mete "Tienes siete propiedades" en la apertura:
// la huella no basta, lo caza el solapamiento de la ventana inicial.
ok(openerKey(H67) !== openerKey(H65), "2d. #67 tiene otra huella (no bastaría con comparar las 3 primeras)");
const v67 = repetitionViolations(guion(H67, "otro cierre distinto del anterior"), [previa(H65, C65)]);
ok(etiquetas(v67).includes("Gancho repetido"), "2e. #67 igual se marca: repite la frase dentro de la apertura");

const v68 = repetitionViolations(guion(H68, C68), [previa(H65, C65), previa(H66, C66), previa(H67, C67)]);
ok(etiquetas(v68).includes("Gancho repetido"), "2f. #68 marca gancho repetido");

// —— Control: el test que impide un detector ciego ——
const limpio = repetitionViolations(
  guion("Compraste la sexta propiedad sin revisar la primera.", "Antes de firmar la séptima, ¿quién miró el conjunto?"),
  [previa(H65, C65), previa(H66, C66), previa(H67, C67)]
);
ok(limpio.length === 0, "2g. CONTROL: un gancho y un cierre genuinamente distintos no disparan nada", etiquetas(limpio).join(", "));

// —— Cierres ——
ok(similarity(C65, C66) >= 0.5, "2h. #66 es el cierre de #65 con otra cola", similarity(C65, C66).toFixed(2));
ok(similarity(C65, C67) >= 0.5, "2i. #67 también", similarity(C65, C67).toFixed(2));
const vC = repetitionViolations(guion("Un gancho totalmente nuevo sobre notarías.", C66), [previa(H65, C65)]);
ok(etiquetas(vC).includes("Cierre repetido"), "2j. el cierre repetido se marca aunque el gancho sea nuevo");

// El CTA fijo de la marca se repite a propósito: copiarlo no es el tic.
const vCta = repetitionViolations(guion("Un gancho totalmente nuevo sobre notarías.", C68), [previa(H66, C68)]);
ok(vCta.length === 0, "2k. el CTA de marca repetido literalmente NO se marca", etiquetas(vCta).join(", "));
ok(similarity(C65, C68) < 0.5, "2l. un cierre de otra naturaleza no se parece", similarity(C65, C68).toFixed(2));

// —— Nunca bloquea ——
const todas = [...v66, ...v67, ...v68, ...vC];
ok(todas.length > 0 && todas.every((v) => v.level === "estilo"), "2m. toda repetición es nivel estilo: repara y avisa, no bloquea");
ok(todas.every((v) => (v.explain || "").length > 20), "2n. cada aviso explica al modelo qué esquivar");

// —— Bloque de evitación ——
const avoid = buildAvoidBlock([previa(H65, C65), previa(H66, C66), previa(H67, C67)]);
ok(avoid.includes("Tienes siete propiedades y tu estructura"), "2o. el bloque lista las aperturas ya usadas, sin asteriscos");
ok(avoid.includes("Cuántas propiedades tenías"), "2p. y los cierres ya usados");
ok(avoid.length <= 6 * 120 * 2 + 600, "2q. cabe en el presupuesto de prompt", `${avoid.length} chars`);
ok(buildAvoidBlock([]) === "", "2r. sin histórico no añade nada al prompt");
ok(buildAvoidBlock([previa(null, null)]) === "", "2s. piezas sin polos tampoco");

// —— Lectura desde lo guardado ——
const polos = piecePoles(JSON.stringify([{ texto: H65 }, { texto: "medio" }, { texto: C65 }]), "guion_video");
ok(polos.gancho === H65 && polos.cierre === C65, "2t. saca gancho y cierre de un guion guardado");
const polosCar = piecePoles(JSON.stringify([{ titulo: "Portada" }, { titulo: "Medio" }, { titulo: "Cierre" }]), "carrusel");
ok(polosCar.gancho === "Portada" && polosCar.cierre === "Cierre", "2u. y de un carrusel");
ok(piecePoles("roto", "guion_video").gancho === null, "2v. JSON inválido no rompe");
ok(piecePoles(JSON.stringify([{ texto: "solo uno" }]), "guion_video").cierre === null, "2w. una pieza de un solo bloque no tiene cierre propio");

// —— El CTA fijo de la marca es corto: no se juzga ——
// Salido de una generación real: "Agenda tu Asesoría de Arquitectura" se marcaba
// como variación de "Reserva tu Asesoría de Arquitectura, link en bio".
const CTA_A = "Agenda tu Asesoría de Arquitectura";
const CTA_B = "Reserva tu Asesoría de Arquitectura, link en bio.";
const vCorto = repetitionViolations(guion("Gancho nuevo sobre notarías y escrituras.", CTA_A), [previa(H66, CTA_B)]);
ok(vCorto.length === 0, "2x. un cierre corto tipo CTA de marca no se marca como repetido", etiquetas(vCorto).join(", "));
ok(similarity(CTA_A, CTA_B) >= 0.5, "2y. y no es porque no se parezcan: se descarta por ser demasiado cortos", similarity(CTA_A, CTA_B).toFixed(2));
// Los cierres largos, que son los que delatan el tic, siguen cazándose.
ok(etiquetas(repetitionViolations(guion("Gancho nuevo.", C67), [previa(H65, C65)])).includes("Cierre repetido"),
  "2z. un cierre largo repetido se sigue marcando");

console.log(fallos ? `\n${fallos} test(s) fallando` : "\nTodos los tests pasan");
process.exit(fallos ? 1 : 0);
