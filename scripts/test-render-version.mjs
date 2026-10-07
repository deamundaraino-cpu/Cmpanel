// Las imágenes salían con `no-store`: cada recarga regeneraba cada portada y
// cada regeneración releía de Postgres fotos de hasta 2,4 MB. Eso consumió el
// egress del plan. Ahora llevan ETag y se revalidan.
//
//   npx tsx scripts/test-render-version.mjs

import { etagFor, matchesEtag, notModified } from "../lib/renderVersion.ts";
import { PRIVATE_IMAGE_HEADERS } from "../lib/slide.tsx";

let fallos = 0;
const ok = (cond, label, detalle = "") => {
  console.log(`${cond ? "PASA " : "FALLA"}  ${label}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallos++;
};

// —— La cabecera que causó el problema ——
const cc = PRIVATE_IMAGE_HEADERS["Cache-Control"];
ok(!cc.includes("no-store"), "10a. las imágenes ya no prohíben almacenarse", cc);
ok(cc.includes("private"), "10b. siguen siendo privadas: solo el navegador, nunca un CDN compartido");
ok(cc.includes("must-revalidate"), "10c. y se revalidan siempre, así que nunca se ve una imagen vieja");

// —— Identidad de la imagen ——
const slides = JSON.stringify([{ titulo: "Siete propiedades", cuerpo: "" }]);
const marca = "huella-marca-1";
const a = etagFor(65, 0, slides, marca);
ok(a === etagFor(65, 0, slides, marca), "10d. la misma pieza da el mismo ETag");
ok(a !== etagFor(65, 1, slides, marca), "10e. otro slide de la misma pieza da otro ETag");
ok(a !== etagFor(66, 0, slides, marca), "10f. otra propuesta da otro ETag");

// Lo que rompía el versionado por contador: cambiar el contenido.
const editado = JSON.stringify([{ titulo: "Siete propiedades y una estructura", cuerpo: "" }]);
ok(a !== etagFor(65, 0, editado, marca), "10g. editar el texto cambia el ETag");
// Y lo que un contador por propuesta NO habría cubierto: cambiar el diseño de marca.
ok(a !== etagFor(65, 0, slides, "huella-marca-2"), "10h. cambiar el diseño de la marca también lo cambia");

ok(/^W\/"[A-Za-z0-9_-]{27}"$/.test(a), "10i. tiene forma de ETag débil válido", a);

// —— Comparación con lo que manda el navegador ——
ok(matchesEtag(a, a), "10j. reconoce su propio ETag");
ok(matchesEtag(a.replace(/^W\//, ""), a), "10k. lo reconoce aunque el navegador quite el prefijo W/");
ok(matchesEtag(`W/"otro", ${a}`, a), "10l. lo encuentra dentro de una lista");
ok(!matchesEtag(null, a), "10m. sin cabecera no hay coincidencia");
ok(!matchesEtag('W/"otro"', a), "10n. un ETag distinto no coincide");
ok(!matchesEtag("", a), "10o. cabecera vacía no coincide");

// —— La respuesta que ahorra el egress ——
const res = notModified(a);
ok(res.status === 304, "10p. responde 304 cuando el navegador ya la tiene");
ok(res.body === null, "10q. sin cuerpo: cero bytes de imagen");
ok(res.headers.get("ETag") === a, "10r. repite el ETag");
ok((res.headers.get("Cache-Control") || "").includes("private"), "10s. y mantiene la respuesta privada");

console.log(fallos ? `\n${fallos} test(s) fallando` : "\nTodos los tests pasan");
process.exit(fallos ? 1 : 0);
