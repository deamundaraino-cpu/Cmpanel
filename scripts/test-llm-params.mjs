// La temperatura estaba fija en 0.7 para todo: escribir una pieza nueva, generar
// una segunda variante del mismo tema y reparar una infracción de marca corrían
// exactamente igual. Sin ninguna fuente de variación, dos generaciones del mismo
// tema convergen.
//
//   npx tsx scripts/test-llm-params.mjs

import { buildRequestBody, TEMP } from "../lib/llm.ts";

let fallos = 0;
const ok = (cond, label, detalle = "") => {
  console.log(`${cond ? "PASA " : "FALLA"}  ${label}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallos++;
};

const gemini = { provider: "gemini", baseUrl: "https://x", model: "m", apiKey: "k" };
const openrouter = { provider: "openrouter", baseUrl: "https://x", model: "m", apiKey: "k" };

// —— Lo que no puede cambiar ——
const base = buildRequestBody(gemini, "SYS", "USER");
ok(base.temperature === 0.7, "8a. sin opciones, la temperatura sigue siendo la de siempre", `${base.temperature}`);
ok(base.max_tokens === 6000, "8b. el margen de tokens se mantiene");
ok(base.messages.length === 2 && base.messages[0].role === "system" && base.messages[1].content === "USER", "8c. los mensajes se montan igual");
ok(base.model === "m", "8d. el modelo viene de la configuración del proveedor");
ok(!("seed" in base), "8e. sin seed explícita no se envía el parámetro");

// —— Lo que ahora se puede variar ——
ok(buildRequestBody(gemini, "S", "U", { maxTokens: 16000 }).max_tokens === 16000, "8h0. el margen de tokens se puede ampliar por llamada");
ok(buildRequestBody(gemini, "S", "U", { temperature: 0.9 }).temperature === 0.9, "8f. la temperatura se puede fijar por llamada");
ok(buildRequestBody(gemini, "S", "U", { temperature: 0 }).temperature === 0, "8g. temperatura 0 no se confunde con 'sin valor'");

// —— seed solo donde el proveedor lo admite ——
ok(buildRequestBody(openrouter, "S", "U", { seed: 42 }).seed === 42, "8h. openrouter admite seed");
ok(!("seed" in buildRequestBody(gemini, "S", "U", { seed: 42 })), "8i. a gemini no se le manda seed: puede rechazar parámetros desconocidos");

// —— Las temperaturas por tarea ——
ok(TEMP.reparacion < TEMP.generacion, "8j. reparar es más conservador que escribir", `${TEMP.reparacion} < ${TEMP.generacion}`);
ok(TEMP.retoque < TEMP.reescritura, "8k. retocar es más conservador que reescribir", `${TEMP.retoque} < ${TEMP.reescritura}`);
ok(TEMP.generacion + TEMP.escalonVariante <= 1.1, "8l. la segunda variante sigue en un rango usable", `${TEMP.generacion + TEMP.escalonVariante}`);
ok(TEMP.escalonVariante > 0, "8m. las dos variantes no se generan con la misma temperatura");

console.log(fallos ? `\n${fallos} test(s) fallando` : "\nTodos los tests pasan");
process.exit(fallos ? 1 : 0);
