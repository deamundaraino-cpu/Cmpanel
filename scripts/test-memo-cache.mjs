// La caché que evita releer la misma foto 20 veces al pintar la página de marca.
// Con las fotos reales de GOEASY, cada lectura evitada son ~2,5 MB de egress.
//
//   npx tsx scripts/test-memo-cache.mjs

import { createCache } from "../lib/memoCache.ts";

let fallos = 0;
const ok = (cond, label, detalle = "") => {
  console.log(`${cond ? "PASA " : "FALLA"}  ${label}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallos++;
};

// —— El caso que motiva todo: 10 composiciones piden la misma foto ——
let reloj = 0;
const c = createCache({ ttlMs: 1000, max: 8, now: () => reloj });
let lecturasABase = 0;
const cargar = (id) => {
  const hit = c.get(id);
  if (hit !== undefined) return hit;
  lecturasABase++;
  const foto = `foto-${id}`;
  c.set(id, foto);
  return foto;
};

for (let i = 0; i < 10; i++) cargar("5:maxg1yf5");
ok(lecturasABase === 1, "9a. 10 renders de la misma foto = 1 sola lectura a Postgres", `${lecturasABase} lecturas`);
ok(c.stats().hits === 9 && c.stats().misses === 1, "9b. 9 aciertos y 1 fallo");

// —— Caducidad ——
reloj = 1500;
ok(c.get("5:maxg1yf5") === undefined, "9c. pasado el TTL la entrada caduca");
reloj = 1600;
cargar("5:maxg1yf5");
ok(lecturasABase === 2, "9d. y se vuelve a leer una vez", `${lecturasABase} lecturas`);

// —— Invalidación al cambiar fotos ——
const c2 = createCache({ ttlMs: 10_000, max: 8, now: () => 0 });
c2.set("5:aaa", "vieja");
c2.set("5:bbb", "vieja");
c2.set("1:ccc", "otra marca");
c2.invalidatePrefix("5:");
ok(c2.get("5:aaa") === undefined && c2.get("5:bbb") === undefined, "9e. subir o borrar una foto invalida las de ESA marca");
ok(c2.get("1:ccc") === "otra marca", "9f. y no toca las de las demás marcas");

// —— Tope de memoria: las fotos pesan, no puede crecer sin límite ——
const c3 = createCache({ ttlMs: 10_000, max: 3, now: () => 0 });
for (const k of ["a", "b", "c", "d"]) c3.set(k, k);
ok(c3.stats().size === 3, "9g. respeta el tope de entradas", `${c3.stats().size}`);
ok(c3.get("a") === undefined && c3.get("d") === "d", "9h. desaloja la más antigua, conserva la más nueva");

const c4 = createCache({ ttlMs: 10_000, max: 2, now: () => 0 });
c4.set("x", "x");
c4.set("y", "y");
c4.get("x"); // usar "x" la rejuvenece
c4.set("z", "z");
ok(c4.get("x") === "x" && c4.get("y") === undefined, "9i. lo usado hace poco sobrevive al desalojo");

// —— Valores nulos: una foto que no existe también se cachea ——
const c5 = createCache({ ttlMs: 10_000, max: 4, now: () => 0 });
c5.set("5:borrada", null);
ok(c5.get("5:borrada") === null, "9j. un 'no existe' se cachea, no se reintenta contra la base");

console.log(fallos ? `\n${fallos} test(s) fallando` : "\nTodos los tests pasan");
process.exit(fallos ? 1 : 0);
