#!/usr/bin/env node
/**
 * Prueba de humo del conector MCP contra un servidor en marcha.
 * Crea un token y un cliente TEMPORAL del dueño, ejercita las herramientas
 * (lectura y escritura) sobre ese cliente y al final borra cliente y token.
 *
 * Uso:
 *   set -a; . ./.env.local; set +a
 *   MCP_BASE=http://localhost:3123 OWNER_EMAIL=… node scripts/smoke-mcp.mjs
 */
import { createHash, randomBytes } from "crypto";
import postgres from "postgres";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const BASE = process.env.MCP_BASE || "http://localhost:3000";
const OWNER = process.env.OWNER_EMAIL;
if (!process.env.DATABASE_URL || !OWNER) {
  console.error("Faltan DATABASE_URL u OWNER_EMAIL.");
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1, prepare: false });

let fails = 0;
const check = (cond, label, extra = "") => {
  console.log(`${cond ? "PASA " : "FALLA"}  ${label}${extra ? ` — ${extra}` : ""}`);
  if (!cond) fails++;
};
const text = (r) => r.content?.map((c) => c.text).join("\n") || "";
const json = (r) => JSON.parse(text(r));

const [owner] = await sql`SELECT id FROM users WHERE email = ${OWNER}`;
if (!owner) throw new Error("No existe el usuario dueño");
const token = "bp_" + randomBytes(24).toString("base64url");
const [tok] = await sql`
  INSERT INTO mcp_tokens (user_id, token_hash, nombre, prefijo, created_at)
  VALUES (${owner.id}, ${createHash("sha256").update(token).digest("hex")}, 'smoke', ${token.slice(0, 10)}, ${new Date().toISOString()})
  RETURNING id
`;
const [cli] = await sql`
  INSERT INTO clients (owner_user_id, created_at, nombre, color, estado)
  VALUES (${owner.id}, ${new Date().toISOString()}, 'MCP prueba', '#3987e5', 'activo') RETURNING id
`;
await sql`INSERT INTO settings (client_id, key, value) VALUES
  (${cli.id}, 'brand_name', 'Marca de prueba'), (${cli.id}, 'brand_niche', 'asesoría de anuncios para infoproductores'),
  (${cli.id}, 'brand_banned', ${"[CRITICO]\ngarantizado | No se pueden prometer resultados"})`;

try {
  // Token inválido → 401
  const bad = await fetch(`${BASE}/api/mcp/bp_invalido_xxxxxxxxxxxxxxxx`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  check(bad.status === 401, "token inválido devuelve 401", String(bad.status));

  const client = new Client({ name: "smoke", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${BASE}/api/mcp/${token}`)));
  check(!!client.getInstructions()?.includes("Brandpanel"), "instrucciones del servidor");

  const { tools } = await client.listTools();
  console.log(`      ${tools.length} herramientas: ${tools.map((t) => t.name).join(", ")}`);
  check(tools.length >= 30, "lista de herramientas completa", String(tools.length));
  const { prompts } = await client.listPrompts();
  check(prompts.length === 4, "4 atajos (prompts)", prompts.map((p) => p.name).join(", "));

  const call = (name, args = {}) => client.callTool({ name, arguments: args });
  const C = Number(cli.id); // postgres.js sin el parser de la app devuelve BIGINT como texto

  const clientes = json(await call("listar_clientes"));
  check(clientes.clientes.some((c) => c.id === C), "listar_clientes incluye el cliente de prueba");

  const sinCliente = await call("ficha_marca", {});
  check(sinCliente.isError || text(sinCliente).includes("CLIENTE"), "ficha_marca sin cliente pide elegir o resuelve el único");

  const ficha = await call("ficha_marca", { cliente: C });
  check(text(ficha).includes("Marca de prueba") && text(ficha).includes("garantizado"), "ficha_marca trae ficha y prohibidos");

  const ajeno = await call("ficha_marca", { cliente: 999999999 });
  check(ajeno.isError, "cliente ajeno o inexistente → error");

  for (const [name, args] of [
    ["resumen_cuenta", { cliente: C, dias: 30 }],
    ["listar_posts", { cliente: C }],
    ["voz_audiencia", { cliente: C }],
    ["banco_ganchos", { cliente: C }],
    ["estructuras", { cliente: C }],
    ["listar_ideas", { cliente: C }],
    ["listar_propuestas", { cliente: C }],
    ["listar_referentes", { cliente: C }],
    ["pipeline", { cliente: C }],
    ["sesiones_grabacion", { cliente: C }],
    ["campanas", { cliente: C }],
  ]) {
    const r = await call(name, args);
    check(!r.isError, name, r.isError ? text(r).slice(0, 160) : "");
  }

  const ctx = await call("contexto_ideas", { cliente: C, modo: "mix" });
  check(!ctx.isError && text(ctx).includes("TESIS, no tema") && text(ctx).includes("guardar_ideas"), "contexto_ideas trae reglas y cómo guardar");

  const idea = (tema, tesis) => ({
    tema, tesis, angulo: "error común", ganchos: ["Gancho uno", "Gancho dos"], formato: "guion_video",
    razon: "pide opinión", pilar: "crecimiento", etapa: "consciencia",
    evidencia: { tipo: "momento", detalle: "Q4 encarece el CPM" },
  });
  const g1 = json(await call("guardar_ideas", {
    cliente: C,
    ideas: [
      idea("Por qué tu CPA se dispara en noviembre", "Si tu CPA se dobla en noviembre, el problema es que tu oferta solo convence a audiencia tibia"),
      idea("El lead magnet que espanta compradores", "Un lead magnet gratuito demasiado completo reduce las ventas del producto de entrada"),
    ],
  }));
  check(g1.guardadas.length === 2, "guardar_ideas guarda 2 ideas nuevas");
  const g2 = json(await call("guardar_ideas", {
    cliente: C,
    ideas: [idea("Por qué tu CPA se dispara en noviembre", "Si tu CPA se dobla en noviembre el problema es tu oferta que solo convence a audiencia tibia")],
  }));
  check(g2.guardadas.length === 0 && g2.rechazadas_por_repetidas.length === 1, "guardar_ideas rechaza la repetida", JSON.stringify(g2.rechazadas_por_repetidas));
  const ideaId = g1.guardadas[0].id;

  const est = json(await call("estructuras", { cliente: C, incluir_formatos_grabacion: false }));
  const estructuraId = est.estructuras.find((e) => e.nombre.startsWith("Hook-Lead"))?.id ?? est.estructuras[0].id;

  const ins = await call("instrucciones_pieza", { cliente: C, formato: "guion_video", idea_id: ideaId, estructura_id: estructuraId });
  check(!ins.isError && text(ins).includes("PLAN DE INTENCIÓN") && text(ins).includes("Tesis que defiende"), "instrucciones_pieza (guion) con la idea", ins.isError ? text(ins) : "");
  const insC = await call("instrucciones_pieza", { cliente: C, formato: "carrusel", idea_id: ideaId });
  check(!insC.isError && text(insC).includes("portada_layout"), "instrucciones_pieza (carrusel)");

  const guion = {
    beats: [
      { seccion: "Hook", texto: "Tu CPA se **dobla en noviembre** y no es culpa del anuncio.", edicion: "A cámara · ~3s" },
      { seccion: "Lead", texto: "En noviembre suben las pujas y solo compra quien ya confiaba en ti.", edicion: "B-roll" },
      { seccion: "Body", texto: "Si tu oferta solo convence a la audiencia tibia, el frío te sale carísimo. Revisa la promesa antes que la creatividad.", edicion: "Pantalla" },
      { seccion: "Open loop", texto: "Y hay una señal en tus métricas que lo delata antes de gastar.", edicion: "Corte rápido" },
      { seccion: "CTA", texto: "Guarda este vídeo para revisarlo antes de Black Friday.", edicion: "A cámara" },
    ],
    caption: "Tu CPA no sube por el anuncio.",
    hashtags: ["#metaads", "#infoproductos"],
    portadas: ["Tu **CPA** no es el anuncio"],
    calidad: { score: 70, razon: "prueba" },
  };
  const malo = structuredClone(guion);
  malo.beats[2].texto += " Resultado garantizado.";
  const val = json(await call("validar_pieza", { cliente: C, guion: malo, estructura_id: estructuraId }));
  check(val.bloquearia === true, "validar_pieza detecta el término crítico");
  const bloq = json(await call("guardar_guion", { cliente: C, estructura_id: estructuraId, guion: malo, idea_id: ideaId }));
  check(bloq.guardado === false, "guardar_guion no guarda con infracción crítica");
  const okG = json(await call("guardar_guion", { cliente: C, estructura_id: estructuraId, guion, idea_id: ideaId, familia_gancho: "resultado_especifico" }));
  check(okG.guardado === true && okG.propuesta_id, "guardar_guion guarda la pieza", JSON.stringify(okG.avisos));
  const [usada] = await sql`SELECT usado_video FROM ideas WHERE id = ${ideaId}`;
  check(usada.usado_video === true, "la idea queda marcada como usada en vídeo");

  const carrusel = {
    slides: [
      { titulo: "Tu **CPA** no es el anuncio", cuerpo: "" },
      { titulo: "Noviembre sube las **pujas**", cuerpo: "Compite más gente por la misma audiencia." },
      { titulo: "Solo compra la **tibia**", cuerpo: "Quien ya confiaba en ti sigue comprando." },
      { titulo: "Revisa la **promesa**", cuerpo: "Antes que la creatividad, revisa qué ofreces." },
      { titulo: "**Guarda** esto", cuerpo: "Revísalo antes de Black Friday." },
    ],
    caption: "Antes de tocar la creatividad.",
    hashtags: ["#metaads"],
    portada_layout: "split",
  };
  const okC = json(await call("guardar_carrusel", { cliente: C, carrusel, idea_id: g1.guardadas[1].id }));
  check(okC.guardado === true, "guardar_carrusel guarda la pieza", JSON.stringify(okC.avisos || okC.infracciones));

  const ver = json(await call("ver_propuesta", { cliente: C, propuesta_id: okG.propuesta_id }));
  check(ver.contenido.length === 5 && ver.contenido[0].portadas?.length === 1, "ver_propuesta devuelve guion con portadas");
  guion.beats[0].texto = "Tu CPA se **dobla en noviembre**, y el anuncio no tiene la culpa.";
  const rep = json(await call("actualizar_propuesta", { cliente: C, propuesta_id: okG.propuesta_id, accion: "reemplazar", guion }));
  check(rep.ok === true, "actualizar_propuesta reemplazar");
  const comp = json(await call("actualizar_propuesta", { cliente: C, propuesta_id: okG.propuesta_id, accion: "compartir" }));
  check(String(comp.enlace).includes("/revisar/"), "actualizar_propuesta compartir da enlace");
  const apr = json(await call("actualizar_propuesta", { cliente: C, propuesta_id: okG.propuesta_id, accion: "aprobar" }));
  check(apr.estado === "aprobada", "aprobar");
  const pipe = json(await call("pipeline", { cliente: C }));
  const pieza = pipe.piezas.find((p) => p.propuesta_id === okG.propuesta_id);
  check(pieza?.estado === "por_grabar", "la propuesta aprobada entra al pipeline en por_grabar");
  const mov = json(await call("actualizar_pieza_pipeline", { cliente: C, pieza_id: pieza.id, brief_edicion: "Cortes rápidos", mover: "avanzar" }));
  check(mov.estado === "grabado", "avanzar fase en el pipeline", mov.estado);

  const ses = json(await call("sesiones_grabacion", { cliente: C, accion: "crear", fecha: "2026-10-25" }));
  check(ses.ok, "crear sesión de grabación");
  const camp = json(await call("campanas", { cliente: C, accion: "crear", nombre: "Black Friday" }));
  check(camp.campana_id, "crear campaña");

  const ref = json(await call("agregar_referente", { cliente: C, handle: "@referente_prueba" }));
  const pz = await call("agregar_pieza_referente", { cliente: C, referente_id: ref.referente_id, texto: "Este es el texto de una pieza de referencia bastante larga para probar.", vistas: 1000 });
  check(!pz.isError && text(pz).includes("guardar_analisis_referente"), "agregar_pieza_referente devuelve instrucciones de análisis");
  const pid = Number(text(pz).match(/id (\d+)/)[1]);
  const an = json(await call("guardar_analisis_referente", {
    cliente: C, pieza_id: pid, gancho: "Nadie te cuenta esto", formato: "reel", estructura: [{ nombre: "Hook", guia: "x" }],
    patron_replicable: "Contradicción", por_que_funciona: "Rompe expectativa", guardar_gancho: true,
  }));
  check(an.ok && an.gancho_en_banco, "guardar_analisis_referente + gancho al banco");
  const ctxRef = await call("contexto_ideas", { cliente: C, modo: "referentes" });
  check(!ctxRef.isError && text(ctxRef).includes("@referente_prueba"), "contexto_ideas modo referentes usa el análisis");

  const di = await call("datos_informe", { cliente: C, tipo: "informe", dias: 30 });
  check(di.isError && text(di).includes("post"), "datos_informe sin posts avisa", text(di).slice(0, 100));
  const inf = json(await call("guardar_informe", { cliente: C, dias: 30, resumen: "r", aciertos: ["a"], riesgos: ["b"], recomendaciones: ["c"], compartir: true }));
  check(String(inf.enlace_publico).includes("/informe/"), "guardar_informe con enlace público");
  const dg = json(await call("guardar_diagnostico", { cliente: C, dias: 30, resumen: "r", fortalezas: ["a"], mejoras: ["b"], acciones: ["c"], mejores_horas: "x", formatos: "y" }));
  check(dg.ok, "guardar_diagnostico");

  const vz = json(await call("agregar_voz_audiencia", { cliente: C, texto: "\"No sé si mi oferta está mal o mis anuncios\" (Reddit)" }));
  check(vz.ok, "agregar_voz_audiencia");
  const desc = json(await call("actualizar_idea", { cliente: C, idea_id: ideaId, descartada: true }));
  check(desc.ok, "actualizar_idea descartar");

  const pr = await client.getPrompt({ name: "buscar_ideas", arguments: { cliente: "MCP prueba" } });
  check(pr.messages[0].content.text.includes("guardar_ideas"), "prompt buscar_ideas");

  await client.close();
} finally {
  await sql`DELETE FROM clients WHERE id = ${cli.id}`;
  await sql`DELETE FROM mcp_tokens WHERE id = ${tok.id}`;
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM ideas WHERE client_id = ${cli.id}`;
  check(n === 0, "limpieza: cliente de prueba borrado en cascada");
  await sql.end();
}

console.log(fails ? `\n${fails} fallos` : "\nTodo OK");
process.exit(fails ? 1 : 0);
