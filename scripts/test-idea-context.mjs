// La idea llegaba al modelo como "tema — ángulo" cortado a 500 caracteres: la
// razón y la evidencia se perdían. Fixture: la idea real de GOEASY de la que
// salieron las propuestas 65-68, que es donde se ve el problema.
//
//   npx tsx scripts/test-idea-context.mjs

import { buildIdeaContext } from "../lib/ideaContext.ts";

let fallos = 0;
const ok = (cond, label, detalle = "") => {
  console.log(`${cond ? "PASA " : "FALLA"}  ${label}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallos++;
};

const idea = {
  tema: "Estructura patrimonial desactualizada en propietarios con varias propiedades",
  angulo: "El portafolio creció y la estructura se quedó en la etapa anterior: se decidió con dos propiedades y hoy hay siete",
  razon: "Tres comentarios del último reel preguntan si conviene pasar las propiedades a una sociedad, y ninguno menciona el conjunto",
  evidencia: JSON.stringify({ tipo: "comentarios", detalle: "5 comentarios pidiendo criterio sobre cuándo cambiar de estructura" }),
};

const ctx = buildIdeaContext(idea);

ok(ctx.includes("Estructura patrimonial desactualizada"), "5a. el tema sobrevive");
ok(ctx.includes("se decidió con dos propiedades y hoy hay siete"), "5b. el ángulo sobrevive (antes se truncaba)");
ok(ctx.includes("Tres comentarios del último reel"), "5c. la razón llega al modelo (antes se perdía entera)");
ok(ctx.includes("5 comentarios pidiendo criterio"), "5d. la evidencia llega al modelo (antes se perdía entera)");
ok(ctx.includes("(comentarios)"), "5e. dice de qué tipo es la evidencia");
ok(ctx.includes("si el guion podría escribirse igual sin ellos, no sirve"), "5f. obliga a usar la materia prima propia de la idea");
ok(ctx.length < 1500, "5g. cabe en el presupuesto de prompt", `${ctx.length} chars`);

// Campos ausentes: nada de etiquetas vacías.
const minima = buildIdeaContext({ tema: "Solo un tema" });
ok(minima === "Punto de partida de esta pieza:\nTema: Solo un tema", "5h. sin ángulo ni evidencia no deja etiquetas colgando", JSON.stringify(minima));
ok(!buildIdeaContext({ tema: "t", razon: "   " }).includes("Por qué ahora"), "5i. un campo en blanco no cuenta como campo");

// Evidencia mal formada: no puede tumbar la generación.
ok(buildIdeaContext({ tema: "t", evidencia: "no es json" }).includes("no es json"), "5j. evidencia no-JSON se usa tal cual");
ok(!buildIdeaContext({ tema: "t", evidencia: JSON.stringify({ tipo: "ganador" }) }).includes("Evidencia"), "5k. evidencia sin detalle se omite");

// Topes por campo, no un corte ciego sobre el total.
const largo = buildIdeaContext({ tema: "T".repeat(500), angulo: "A".repeat(900), razon: "R".repeat(900) });
ok(largo.includes("T".repeat(299) + "…"), "5l. el tema se recorta a su propio tope");
ok(largo.includes("A".repeat(399) + "…"), "5m. el ángulo tiene su propio tope, no comparte el del tema");
ok(largo.includes("Por qué ahora"), "5n. la razón sigue presente aunque el tema fuera larguísimo");

console.log(fallos ? `\n${fallos} test(s) fallando` : "\nTodos los tests pasan");
process.exit(fallos ? 1 : 0);
