// Limpieza de recortes: islas fuera, recorte sano intacto y zona rota fundida.
// Imágenes sintéticas que reproducen lo visto en los recortes reales de MODNet.
//
//   npx tsx scripts/test-cutout-cleanup.mjs

import { cleanAlpha } from "../lib/cutoutCleanup.ts";

let fallos = 0;
const ok = (cond, label, detalle = "") => {
  console.log(`${cond ? "PASA " : "FALLA"}  ${label}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallos++;
};

const W = 100;
const H = 200;
/** Figura: un rectángulo sólido (x 30-70, y 10-199). */
function figura() {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 10; y < H; y++) for (let x = 30; x < 70; x++) data[(y * W + x) * 4 + 3] = 255;
  return data;
}
const a = (data, x, y) => data[(y * W + x) * 4 + 3];

// 1. Sano: no se toca ni un píxel de la figura.
{
  const data = figura();
  const st = cleanAlpha({ data, width: W, height: H });
  ok(st.islasBorradas === 0, "recorte sano: sin islas");
  ok(a(data, 50, 199) === 255 && a(data, 31, 190) === 255, "recorte sano: los pies no se funden");
}

// 1b. Cuerpo entero sano: bordes suaves solo en los pies (último 8 %) → sin fundido.
{
  const data = figura();
  for (let y = 186; y < H; y++) for (let x = 30; x < 70; x++) if (x % 2) data[(y * W + x) * 4 + 3] = 140;
  const st = cleanAlpha({ data, width: W, height: H });
  ok(st.inicioFundido === st.altoFigura, "bordes suaves en los pies no cuentan como zona rota");
  ok(a(data, 31, 195) === 140, "los pies quedan como estaban");
}

// 2. Islas: una mancha suelta desaparece; una parte grande separada se queda.
{
  const data = figura();
  for (let y = 180; y < 186; y++) for (let x = 2; x < 8; x++) data[(y * W + x) * 4 + 3] = 255; // mancha 36 px
  for (let y = 40; y < 90; y++) for (let x = 80; x < 95; x++) data[(y * W + x) * 4 + 3] = 255; // brazo 750 px
  const st = cleanAlpha({ data, width: W, height: H });
  ok(a(data, 4, 182) === 0, "la mancha suelta se borra");
  ok(a(data, 85, 60) === 255, "una parte del cuerpo separada se conserva");
  ok(st.islasBorradas === 1, "cuenta una isla borrada", String(st.islasBorradas));
}

// 3. Zona rota: de y=150 hacia abajo, alfa a medias (ruido de segmentación).
{
  const data = figura();
  for (let y = 150; y < H; y++) for (let x = 30; x < 70; x++) if ((x + y) % 3 === 0) data[(y * W + x) * 4 + 3] = 120;
  const st = cleanAlpha({ data, width: W, height: H });
  ok(st.inicioFundido < st.altoFigura, "detecta la zona rota", `${st.inicioFundido}/${st.altoFigura}`);
  ok(a(data, 50, 60) === 255, "el torso queda intacto");
  ok(a(data, 50, 198) < 30, "el borde inferior se funde", String(a(data, 50, 198)));
  ok(a(data, 32, 180) < a(data, 50, 180), "los lados se funden antes que el centro");
  const inicioAbs = 10 + st.inicioFundido;
  ok(inicioAbs >= 10 + Math.round(190 * 0.55), "nunca empieza por encima del 55 %");
}

if (fallos) {
  console.log(`\n${fallos} fallo(s)`);
  process.exit(1);
}
console.log("\nTodo OK");
