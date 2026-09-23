// Tests del filtro de reglas de marca. Casos tomados de salidas reales que
// fallaron en GOEASY (Cris Tributario). No llaman al modelo: verifican la
// clasificación determinista (crítico / estilo) y los chequeos estructurales.
//
//   npx tsx scripts/test-brand-rules.mjs

import { parseBannedRules, findViolations, structuralViolations, isBlocking } from "../lib/brandRules.ts";

// Extracto de la lista real de la marca, con los dos niveles.
const LISTA = `
[CRITICO]
/55\\s?bis/ | El Art. 55 bis no se usa en contenido: tiene tope de renta y la mayoría del avatar no califica.
/sociedad.{0,40}global complementario/i | Error factual: las sociedades no tributan en Global Complementario; ese impuesto es de personas naturales.
/global complementario.{0,40}sociedad/i | Error factual: el Global Complementario es de personas naturales, no de sociedades.
/\\bholding\\b/ | Regla 5, nada de consejo universal: proponer un holding como solución es tan falso como descartarlo. La estructura correcta depende del caso.
/en 20\\d\\d (el SII|la norma|la ley)/i | Prohibido anunciar cambios normativos: no se afirma que una norma cambia en un año concreto.
/(el SII|la norma|la ley) (ahora )?(exige|exigirá|obliga|obligará)/i | Prohibido anunciar exigencias normativas nuevas sin fuente validada.
/\\d+\\s?%/ | Prohibido inventar cifras: todo porcentaje debe venir del brief o ir como [DATO A VALIDAR].
radiografía patrimonial | El servicio se llama Asesoría de Arquitectura.
sin costo | Nunca se presenta el primer paso como gratuito.

[ESTILO]
/\\b(cuarta|quinta|sexta) (señal|razón|error|clave)/i | Nada de listas de más de 3 elementos: acumular señales suena a alarma, no a diagnóstico.
/(que|lo que) nadie (dice|cuenta|te dice)/i | Muletilla de reel viral prohibida por el tono de la marca.
plusvalía | Glosario chileno: se dice "mayor valor".
`;

const rules = parseBannedRules(LISTA);

const CRITICOS = [
  ["1. cambio normativo inventado", "En 2026 el SII exige que al menos el 80% de la inversión sea local."],
  ["2. sociedad en Global Complementario", "Una sociedad que tributa según el Global Complementario paga distinto."],
  ["3. holding como receta universal", "Al crear el holding antes de la herencia, el Global Complementario se difiere."],
  ["4. 55 bis en contenido", "Aprovecha el beneficio del 55 bis para bajar tu carga."],
];

const ESTILO = [
  ["5. cuarta señal + muletilla", "La cuarta señal, la que nadie dice, es la que más cuesta."],
  ["6. CTA múltiple", "Guarda esta lista, comenta cuál te pasa o escribe la palabra clave por DM."],
];

let fallos = 0;
const ok = (cond, label, detalle = "") => {
  console.log(`${cond ? "PASA " : "FALLA"}  ${label}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallos++;
};

console.log("— CRÍTICOS (deben bloquear la propuesta) —");
for (const [label, texto] of CRITICOS) {
  const v = findViolations(texto, rules);
  ok(isBlocking(v), label, v.map((x) => x.label).join(" · ") || "sin detección");
}

console.log("\n— ESTILO (reparar y, si sobreviven, marcar sin bloquear) —");
for (const [label, texto] of ESTILO) {
  const v = [...findViolations(texto, rules), ...structuralViolations({ slides: [{ titulo: "x", cuerpo: texto }] })];
  ok(v.length > 0 && !isBlocking(v), label, v.map((x) => x.label).join(" · ") || "sin detección");
}

// 7. El gancho anuncia tres señales y el cuerpo entrega cuatro.
const desajuste = {
  slides: [
    { titulo: "3 **señales** de que tu estructura se quedó atrás", cuerpo: "" },
    { titulo: "Primera señal", cuerpo: "Sigues declarando propiedad por propiedad." },
    { titulo: "Segunda señal", cuerpo: "Nadie mira el conjunto." },
    { titulo: "Tercera señal", cuerpo: "Compraste sin revisar la base." },
    { titulo: "Cuarta señal", cuerpo: "La sucesión no está prevista." },
    { titulo: "Cierre", cuerpo: "Agenda tu Asesoría de Arquitectura." },
  ],
};
const v7 = structuralViolations(desajuste);
ok(v7.length > 0 && !isBlocking(v7), "7. anuncia 3 señales y entrega 4", v7.map((x) => x.label).join(" · ") || "sin detección");

// Control: una pieza correcta no debe disparar nada.
const limpia = {
  slides: [
    { titulo: "Tu estructura es la que armaste con **dos propiedades**", cuerpo: "El portafolio creció y el diseño se quedó en la etapa anterior." },
    { titulo: "Qué mira el **SII**", cuerpo: "Revisa cómo se relacionan propiedades, sociedades y contratos de arriendo." },
    { titulo: "El siguiente paso", cuerpo: "Agenda tu Asesoría de Arquitectura." },
  ],
};
const v0 = [...findViolations(JSON.stringify(limpia), rules), ...structuralViolations(limpia)];
ok(v0.length === 0, "control: pieza correcta sin incumplimientos", v0.map((x) => x.label).join(" · "));

console.log(fallos ? `\n${fallos} test(s) fallando` : "\nTodos los tests pasan");
process.exit(fallos ? 1 : 0);
