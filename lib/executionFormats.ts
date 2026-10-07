import type { Pilar } from "./pilares";

/**
 * Formatos de GRABACIÓN: cómo se filma una pieza, no qué dice.
 *
 * Base: los 35 "Formatos Validados de Criativos" de VK Metrics (agencia de
 * tráfego brasileña, material de anuncios de lanzamientos), filtrados con este
 * criterio:
 *   - Se quedan aquí los que describen la EJECUCIÓN (encuadre, soporte, set).
 *   - Los que describen la NARRATIVA (Mito vs fato, Nós vs eles, A+B+C,
 *     Ranking, Tierlist, Passo a passo, Lista, Depoimento, Caixinha, POV,
 *     Breaking news) se convirtieron además en estructuras de guion
 *     (lib/baseStructures.ts), porque el guion necesita los bloques.
 *   - "Carro" se fusiona con "Lo-fi" y con el walking listicle: el valor es el
 *     movimiento y la naturalidad, no el coche.
 *   - "Dinâmico" no es un formato sino un estilo de edición (cambio de plano
 *     cada pocos segundos) y se aplica a todos; queda como nota de edición.
 *   - "Curiosidade" es un tipo de gancho (curiosity gap), no un formato: vive
 *     en las familias de gancho (lib/angles.ts).
 *
 * Son datos estáticos: no dependen del cliente y no necesitan BD.
 */

export type Coste = "bajo" | "medio" | "alto";

export type ExecutionFormat = {
  id: string;
  nombre: string;
  /** De dónde sale: formato y creador del vault de VK, u otra fuente. */
  origen: string;
  /** Cómo se graba, en una o dos frases operativas. */
  como: string;
  /** Por qué retiene o convierte. */
  porque: string;
  coste: Coste;
  pilares: Pilar[];
  /** Instrucción para las notas de edición del guion. */
  edicion: string;
  /** Advertencia de uso, si la hay. */
  ojo?: string;
};

export const EXECUTION_FORMATS: ExecutionFormat[] = [
  {
    id: "talking_head",
    nombre: "Talking head",
    origen: "VK · Talking Head (Leandro Ferrari)",
    como: "A cámara, plano medio-corto, mirando al objetivo. El formato por defecto de la marca personal.",
    porque: "Es el más barato de producir y el que más confianza transmite: la cara y la voz son la prueba de que hay una persona detrás. Por eso aguanta volumen semanal.",
    coste: "bajo",
    pilares: ["crecimiento", "adoctrinamiento", "conversion"],
    edicion: "Plano medio-corto a cámara; alterna con un plano más cerrado cada 3-4 s, subtítulos siempre y texto en pantalla solo en la frase clave.",
  },
  {
    id: "palestrinha",
    nombre: "Mini-charla ante pantalla",
    origen: "VK · Palestrinha (Marcelo Távora)",
    como: "De pie frente a una TV o pantalla con una diapositiva o gráfico; la persona señala y explica como en una clase corta.",
    porque: "El soporte visual da autoridad de 'clase' y retiene porque el ojo alterna entre persona y pantalla. Funciona para explicar un concepto y cerrar con una invitación.",
    coste: "medio",
    pilares: ["adoctrinamiento", "conversion"],
    edicion: "Plano abierto con la pantalla visible; inserta la diapositiva a pantalla completa cuando se explica el dato y vuelve a la persona en el cierre.",
  },
  {
    id: "pizarra",
    nombre: "Pizarra",
    origen: "VK · Quadro branco (Camile Vilela)",
    como: "Se dibuja el concepto en una pizarra mientras se explica: un esquema, una fórmula o una comparación.",
    porque: "Ver cómo se construye el esquema obliga a quedarse hasta que esté completo (retención) y el resultado final es una imagen que se guarda.",
    coste: "medio",
    pilares: ["adoctrinamiento", "crecimiento"],
    edicion: "Plano fijo que deja ver pizarra y persona; acelera los trazos largos y termina con el esquema completo en pantalla 2 s.",
  },
  {
    id: "papel_boli",
    nombre: "Papel y bolígrafo (cenital)",
    origen: "VK · Papel e Caneta (Hudison Miguel)",
    como: "Cámara cenital sobre una hoja; solo se ven las manos escribiendo o dibujando y la voz narra.",
    porque: "Versión sin cara de la pizarra: muy barata, íntima y fácil de repetir en serie.",
    coste: "bajo",
    pilares: ["adoctrinamiento", "crecimiento"],
    edicion: "Cenital fijo, voz en off, acelera la escritura y resalta con zoom la palabra o cifra clave.",
  },
  {
    id: "bloc_notas",
    nombre: "Nota del móvil",
    origen: "VK · Bloco de notas (Tiago Brunet)",
    como: "Captura o grabación de una nota del móvil con una frase o lista corta, sin cara, con música.",
    porque: "Imita un mensaje personal: se lee en segundos y se reenvía por DM, que es la señal que más pesa para llegar a no seguidores.",
    coste: "bajo",
    pilares: ["crecimiento"],
    edicion: "Pantalla completa de la nota, texto apareciendo línea a línea, música de fondo sin voz; firma de la marca al final.",
    ojo: "Solo vale para ideas que se sostienen escritas en pocas líneas; no sirve para explicar un método.",
  },
  {
    id: "texto_pantalla",
    nombre: "Texto en pantalla sobre clip",
    origen: "VK · Texto na tela (Marcelo Távora) · Lo-fi (Micha Menezes)",
    como: "Un clip ambiente o de la persona sin hablar y el mensaje entero escrito en pantalla.",
    porque: "La mayoría ve los reels sin sonido; si el texto es el contenido, el mensaje llega igual. Es el formato más rápido de producir en lote.",
    coste: "bajo",
    pilares: ["crecimiento"],
    edicion: "Clip de 5-10 s en bucle, texto grande en el tercio superior, cada frase visible 1-2 s.",
  },
  {
    id: "pantalla_real",
    nombre: "Mostrando la pantalla",
    origen: "VK · Mostrando celular/computador (Marcelo Távora)",
    como: "Se graba la pantalla del móvil u ordenador (panel, resultados, herramienta) mientras se comenta.",
    porque: "La pantalla es la prueba: no hace falta creer, se ve. Por eso convierte mejor que contar el resultado.",
    coste: "bajo",
    pilares: ["adoctrinamiento", "conversion"],
    edicion: "Grabación de pantalla con zoom y círculo sobre la cifra que importa; la cara en una esquina o en los cortes.",
    ojo: "Nunca mostrar datos de clientes sin permiso ni cifras que la marca no pueda sostener.",
  },
  {
    id: "stories_nativo",
    nombre: "Estética de stories",
    origen: "VK · Stories nativo (Marcelo Távora)",
    como: "Grabado con la cámara de stories, con stickers y texto nativo de Instagram, como si fuera una historia.",
    porque: "No parece anuncio ni producción: baja la defensa del espectador y se percibe como contenido de amigo.",
    coste: "bajo",
    pilares: ["crecimiento", "conversion"],
    edicion: "Selfie vertical, texto y stickers nativos, sin cortes elaborados.",
  },
  {
    id: "green_screen",
    nombre: "Pantalla verde",
    origen: "VK · Tela verde (Hanah Franklin)",
    como: "La persona aparece delante de una captura, artículo, post o gráfico y lo comenta.",
    porque: "Pone la fuente en pantalla mientras se opina: da contexto y prueba sin edición compleja.",
    coste: "bajo",
    pilares: ["crecimiento", "adoctrinamiento"],
    edicion: "Fondo con la captura que se comenta; cambia de captura en cada idea nueva.",
  },
  {
    id: "react",
    nombre: "Reacción (pantalla dividida)",
    origen: "VK · React (Leandro Ferrari)",
    como: "Arriba el contenido original, abajo la persona reaccionando y corrigiendo o ampliando.",
    porque: "El contraste entre lo que se dice y lo que se muestra retiene, y la reacción toma prestada la atención de un contenido que ya funcionó.",
    coste: "medio",
    pilares: ["crecimiento"],
    edicion: "Pantalla dividida; pausa el original en la frase que se discute y vuelve a la persona.",
    ojo: "Se reacciona a ideas, nunca contra personas: no nombrar ni ridiculizar a otros creadores.",
  },
  {
    id: "podcast",
    nombre: "Corte de podcast",
    origen: "VK · Podcast (Luana Carolina)",
    como: "Fragmento de una conversación en un set con micrófonos: una pregunta y la respuesta más contundente.",
    porque: "El set transmite autoridad de invitado experto y el formato pregunta-respuesta ya trae la tensión hecha.",
    coste: "alto",
    pilares: ["adoctrinamiento", "crecimiento"],
    edicion: "Dos planos (pregunta y respuesta), subtítulos dinámicos y el corte empieza en la frase más fuerte, no en el saludo.",
  },
  {
    id: "entrevista",
    nombre: "Entrevista",
    origen: "VK · Entrevista (Marcelo Távora) · Man on the street (Social Media Examiner)",
    como: "La persona entrevista a otra (cliente, colega o alguien en la calle) con preguntas cortas.",
    porque: "La respuesta de un tercero vale como prueba social y la curiosidad por la respuesta retiene.",
    coste: "medio",
    pilares: ["adoctrinamiento", "conversion"],
    edicion: "Plano de dos, micrófono visible, texto en pantalla con la pregunta.",
  },
  {
    id: "meet",
    nombre: "Videollamada grabada",
    origen: "VK · Meet (Marcelo Távora)",
    como: "Fragmento real de una sesión por videollamada con un cliente o alumno, con su permiso.",
    porque: "Es la prueba de método más creíble: se ve el trabajo ocurriendo, no un resumen.",
    coste: "bajo",
    pilares: ["adoctrinamiento", "conversion"],
    edicion: "Pantalla de la llamada con nombres ocultos si hace falta; titular arriba con lo que se está resolviendo.",
    ojo: "Siempre con permiso explícito de la otra persona.",
  },
  {
    id: "testimonio",
    nombre: "Testimonio",
    origen: "VK · Depoimento (Leandro Ferrari) · UGC (Rafaela Chagas)",
    como: "El cliente cuenta su caso con sus palabras, grabado por la marca o por él mismo con su móvil.",
    porque: "Lo que dice un par pesa más que lo que dice la marca de sí misma.",
    coste: "medio",
    pilares: ["conversion", "adoctrinamiento"],
    edicion: "Plano del cliente, cifra o resultado en texto en pantalla, cierre con la marca.",
    ojo: "Resultados reales y con contexto; nada de prometer que se repiten siempre.",
  },
  {
    id: "clon",
    nombre: "Dos personajes (clon)",
    origen: "VK · Clone (Luíza Cureau) · Two characters, one light bulb (Social Media Examiner)",
    como: "La misma persona interpreta dos papeles (el escéptico y el experto, o el que lo hace mal y el que lo hace bien) en planos alternos.",
    porque: "Convierte una explicación en diálogo: las objeciones del público las dice el 'otro personaje' y se responden en directo.",
    coste: "medio",
    pilares: ["crecimiento", "conversion"],
    edicion: "Plano/contraplano con un cambio visual claro entre personajes (ropa, lado, rótulo).",
  },
  {
    id: "caja_preguntas",
    nombre: "Respuesta a pregunta",
    origen: "VK · Caixinha de pergunta (Tay Dantas)",
    como: "Se muestra en pantalla la pregunta real de un seguidor (sticker de preguntas) y se responde a cámara.",
    porque: "La pregunta literal hace que quien tiene la misma duda se reconozca; además invita a preguntar más (comunidad).",
    coste: "bajo",
    pilares: ["adoctrinamiento", "crecimiento"],
    edicion: "Sticker de la pregunta arriba todo el vídeo; respuesta a cámara.",
  },
  {
    id: "pov",
    nombre: "POV",
    origen: "VK · POV (Luana Carolina)",
    como: "Texto 'POV: …' que sitúa al espectador en una escena reconocible y la persona actúa la situación.",
    porque: "Las escenas demasiado reales son las que más se reenvían ('esto eres tú').",
    coste: "bajo",
    pilares: ["crecimiento"],
    edicion: "Texto POV en pantalla desde el primer frame, actuación sin hablar o con poca voz, 7-15 s.",
  },
  {
    id: "lofi_movimiento",
    nombre: "Lo-fi en movimiento",
    origen: "VK · Lo-fi (Micha Menezes) · Carro (Guilherme Benchimol) · Walking listicle (Social Media Examiner)",
    como: "Hablando mientras se camina o en el coche, con el móvil en la mano, sin set.",
    porque: "El movimiento da energía y parece una llamada, no una clase; es el formato con menos fricción para grabar en cualquier momento.",
    coste: "bajo",
    pilares: ["crecimiento", "adoctrinamiento"],
    edicion: "Sin estabilizar en exceso; subtítulos grandes porque el fondo cambia.",
  },
  {
    id: "vlog",
    nombre: "Vlog",
    origen: "VK · Vlog (Giullya Becker)",
    como: "Fragmentos del día a día de trabajo con narración que une las escenas.",
    porque: "Muestra el proceso real detrás del resultado: genera cercanía y hace creíble la autoridad.",
    coste: "medio",
    pilares: ["adoctrinamiento"],
    edicion: "Clips cortos de 1-3 s, voz en off que da el hilo, un solo mensaje por vídeo.",
  },
  {
    id: "cronometro",
    nombre: "Contra reloj",
    origen: "VK · Cronômetro (Marcelo Távora) · Challenge (Social Media Examiner)",
    como: "Un reto con tiempo visible en pantalla: hacer algo en X minutos.",
    porque: "El cronómetro crea tensión y una promesa de desenlace: se quedan para ver si se logra.",
    coste: "medio",
    pilares: ["crecimiento", "adoctrinamiento"],
    edicion: "Cronómetro grande siempre visible, cortes acelerados, resultado final en pantalla completa.",
  },
  {
    id: "congelada",
    nombre: "Imagen congelada",
    origen: "VK · Imagem congelada (Marcelo Távora)",
    como: "Se congela un frame con un titular grande y luego arranca el vídeo.",
    porque: "Es una interrupción de patrón: el primer frame estático con titular para el scroll, que se decide en menos de 2 s.",
    coste: "bajo",
    pilares: ["crecimiento", "conversion"],
    edicion: "Primer frame congelado 0,5-1 s con el titular; después el vídeo normal.",
  },
  {
    id: "tierlist_visual",
    nombre: "Tabla de tiers",
    origen: "VK · Tierlist (Alex Hormozi) · Ranking (Phill Rocha)",
    como: "Plantilla de niveles en pantalla que se va rellenando mientras se clasifica.",
    porque: "La clasificación provoca desacuerdo: la gente comenta su propio orden y lo envía a quien piensa distinto.",
    coste: "medio",
    pilares: ["crecimiento"],
    edicion: "Plantilla de tiers fija en la mitad superior; cada elemento entra con animación al colocarse.",
  },
  {
    id: "noticiero",
    nombre: "Noticiero",
    origen: "VK · Breaking news (Dylan Page)",
    como: "Rótulo de última hora con fecha y la persona contando el cambio y qué significa.",
    porque: "La novedad tiene urgencia propia y posiciona como la persona que está al día.",
    coste: "bajo",
    pilares: ["crecimiento"],
    edicion: "Rótulo de noticia con fecha en el primer frame, captura de la fuente en pantalla.",
    ojo: "Solo noticias verificables con fuente; nunca inventar cambios ni anticipar normas.",
  },
  {
    id: "narrado",
    nombre: "Voz en off sobre B-roll",
    origen: "VK · Narrado (Prisciane)",
    como: "Voz en off sobre imágenes de apoyo, sin cara.",
    porque: "Permite contar historias con ritmo de documental y producir sin aparecer.",
    coste: "medio",
    pilares: ["adoctrinamiento", "crecimiento"],
    edicion: "B-roll que ilustra literalmente cada frase, cambio de plano cada 1,5-3 s.",
  },
];

export function formatById(id: string | null | undefined): ExecutionFormat | undefined {
  return id ? EXECUTION_FORMATS.find((f) => f.id === id) : undefined;
}

/** Bloque para el prompt del guion: cómo se va a grabar, para que las notas de edición encajen. */
export function executionContext(id: string | null | undefined): string {
  const f = formatById(id);
  if (!f) return "";
  return `\n\nFORMATO DE GRABACIÓN elegido: ${f.nombre}. ${f.como} Escribe el guion pensando en este formato y las notas de edición siguiendo esta pauta: ${f.edicion}${f.ojo ? ` Límite: ${f.ojo}` : ""}`;
}
