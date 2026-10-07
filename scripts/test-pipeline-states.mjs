// Flujos de producción por formato: vídeo pasa por grabación, carrusel no.
//
//   npx tsx scripts/test-pipeline-states.mjs

import { stepState, isValidState, normalizeState, initialStateFor, flowFor } from "../lib/pipelineStates.ts";

let fallos = 0;
const ok = (cond, label, detalle = "") => {
  console.log(`${cond ? "PASA " : "FALLA"}  ${label}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallos++;
};

ok(stepState("guion_video", "por_grabar", 1) === "grabado", "vídeo: por grabar → grabado");
ok(stepState("guion_video", "grabado", 1) === "en_edicion", "vídeo: grabado → en edición");
ok(stepState("carrusel", "idea", 1) === "en_edicion", "carrusel se salta la grabación");
ok(stepState("carrusel", "en_edicion", -1) === "idea", "carrusel retrocede a idea");
ok(stepState("carrusel", "publicado", 1) === null, "no hay fase después de publicado");
ok(stepState("guion_video", "idea", -1) === null, "no hay fase antes de idea");
ok(stepState("carrusel", "grabado", 1) === "en_edicion", "carrusel en estado de vídeo se recoloca");
ok(normalizeState("en_diseno") === "en_edicion", "alias legado en_diseno");
ok(stepState("carrusel", "en_diseno", 1) === "revision", "avanza desde el estado legado");
ok(isValidState("revision") && isValidState("en_diseno"), "estados válidos");
ok(!isValidState("borrador") && !isValidState(3), "estados inválidos");
ok(initialStateFor("guion_video") === "por_grabar", "guion aprobado entra por grabar");
ok(initialStateFor("carrusel") === "en_edicion", "carrusel aprobado entra en edición");
ok(flowFor(null).length === 5, "sin formato = flujo de carrusel");

if (fallos) {
  console.log(`\n${fallos} fallo(s)`);
  process.exit(1);
}
console.log("\nTodo OK");
