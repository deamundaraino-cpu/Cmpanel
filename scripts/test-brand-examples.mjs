// El bloque de piezas aprobadas exponía el gancho y el cierre de las últimas 3
// y ordenaba imitarlos. Con estas tres piezas reales de GOEASY dentro, el
// generador escribió un cuarto guion que abría igual que los tres anteriores.
// Los fixtures son esas piezas tal cual quedaron guardadas.
//
//   npx tsx scripts/test-brand-examples.mjs

import { formatExamplesBlock } from "../lib/brandExamples.ts";

let fallos = 0;
const ok = (cond, label, detalle = "") => {
  console.log(`${cond ? "PASA " : "FALLA"}  ${label}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallos++;
};

const fila = (beats) => ({ slides: JSON.stringify(beats) });

// Propuestas 65, 66 y 67 de GOEASY (client 5), recortadas.
const p65 = fila([
  { seccion: "Hook", texto: "**Tienes siete propiedades** y tu estructura sigue siendo la que armaste con dos." },
  { seccion: "Lead", texto: "No es que hayas hecho algo mal; es que esa decisión simplemente no se tomó." },
  { seccion: "Body 1", texto: "Cuando firmas la compra de la cuarta propiedad, el banco pregunta por el RUT y el notario pide la escritura." },
  { seccion: "Open Loop 1", texto: "Y esa forma de comprar se nota recién cuando quieres pasar una propiedad a una sociedad." },
  { seccion: "Body 2", texto: "Ese mismo automatismo se repite cada año: el contador revisa cada uno por separado y nadie mira cómo se conectan entre sí." },
  { seccion: "Open Loop 2", texto: "Y esa desconexión se vuelve crítica cuando el patrimonio tiene que explicarse completo." },
  { seccion: "Body 3", texto: "Se revisa el conjunto, no cada propiedad por separado." },
  { seccion: "CTA", texto: "¿Cuántas propiedades tenías cuando se definió tu estructura actual?" },
]);
const p66 = fila([
  { seccion: "Contexto", texto: "Tienes siete propiedades y sigues declarando cada una por separado. Llevas años así y ahora estás por comprar la octava." },
  { seccion: "Conflicto", texto: "Vas a comprar la octava y alguien te pregunta cómo encaja con las demás." },
  { seccion: "Punto de giro", texto: "Entendiste que declarar cada propiedad por separado ya no mostraba cómo el patrimonio realmente se movía." },
  { seccion: "Resolución", texto: "Desde entonces, antes de comprar revisas cómo afecta al conjunto. Por primera vez la siguiente compra se decidió antes de firmar, no en la notaría." },
  { seccion: "Lección", texto: "La contabilidad sigue a la realidad del patrimonio, no al revés." },
  { seccion: "CTA", texto: "¿Cuántas propiedades tenías cuando se definió tu forma actual de declarar?" },
]);
const p67 = fila([
  { seccion: "Hook", texto: "**Heredar todo a nombre personal**. Tienes siete propiedades y crees que dejarlas así es la forma más simple." },
  { seccion: "Lead", texto: "No es que hayas hecho algo mal; es que nunca se tomó la decisión de diseñar cómo se transmite ese patrimonio." },
  { seccion: "Body 1", texto: "Cuando compraste tu tercera propiedad, firmaste la escritura a nombre personal, como siempre lo habías hecho." },
  { seccion: "Open Loop 1", texto: "Esa forma de titular se repite en cada nueva compra." },
  { seccion: "Body 2", texto: "Al presentar tu declaración de renta, cada arriendo se ingresa como ingreso separado, sin que se vea cómo se suman al patrimonio total." },
  { seccion: "Open Loop 2", texto: "Esa forma de declarar se nota recién cuando llega el momento de transmitir el patrimonio." },
  { seccion: "Body 3", texto: "Cuando llega el momento de heredar, el patrimonio queda a nombre de los herederos como personas naturales." },
  { seccion: "CTA", texto: "¿Cuántas propiedades tenías cuando se definió la forma en que las tienes a nombre personal?" },
]);

const bloque = formatExamplesBlock([p65, p66, p67], "guion_video");

// 1. Lo que NO puede seguir entrando: la apertura y el cierre repetidos.
ok(!bloque.includes("Tienes siete propiedades"), "1a. no expone el gancho que las tres piezas comparten");
ok(!bloque.includes("¿Cuántas propiedades tenías"), "1b. no expone el cierre que las tres piezas comparten");
ok(!bloque.includes("Heredar todo a nombre personal"), "1c. tampoco el gancho de la tercera");

// 2. Lo que SÍ debe entrar: el cuerpo, donde vive el registro de la marca.
ok(bloque.includes("Ese mismo automatismo se repite cada año"), "2a. incluye el beat central de #65");
ok(bloque.includes("Desde entonces, antes de comprar revisas cómo afecta al conjunto"), "2b. incluye el beat central de #66");
ok(bloque.includes("Al presentar tu declaración de renta"), "2c. incluye el beat central de #67");

// 3. La instrucción ya no manda imitar la forma.
ok(!bloque.includes("dónde coloca la frase clave"), "3a. ya no pide imitar dónde va la frase clave");
ok(bloque.includes("NUNCA se copia la apertura, el cierre"), "3b. prohíbe explícitamente copiar apertura y cierre");

// 4. Límites y casos vacíos (comportamiento que no debe cambiar).
ok(bloque.length <= 1200 + 600, "4a. el bloque cabe en el presupuesto", `${bloque.length} chars`);
ok(formatExamplesBlock([], "guion_video") === "", "4b. sin piezas aprobadas devuelve cadena vacía");
ok(formatExamplesBlock([fila([{ seccion: "Hook", texto: "solo" }, { seccion: "CTA", texto: "cierre" }])], "guion_video") === "",
  "4c. una pieza de solo apertura y cierre no aporta ejemplo");
ok(formatExamplesBlock([fila([])], "guion_video") === "", "4d. pieza vacía no rompe");
ok(formatExamplesBlock([{ slides: "esto no es json" }], "guion_video") === "", "4e. JSON inválido no rompe");

// 5. Carrusel: mismo criterio, un slide del cuerpo y no la portada.
const carrusel = { slides: JSON.stringify([
  { titulo: "**Tienes siete propiedades**", cuerpo: "portada" },
  { titulo: "Qué mira el SII", cuerpo: "Revisa cómo se relacionan propiedades, sociedades y contratos." },
  { titulo: "El siguiente paso", cuerpo: "Agenda tu Asesoría de Arquitectura." },
]) };
const bloqueCar = formatExamplesBlock([carrusel], "carrusel");
ok(!bloqueCar.includes("Tienes siete propiedades"), "5a. no expone la portada del carrusel");
ok(bloqueCar.includes("Qué mira el SII"), "5b. expone un slide del cuerpo");

console.log(fallos ? `\n${fallos} test(s) fallando` : "\nTodos los tests pasan");
process.exit(fallos ? 1 : 0);
