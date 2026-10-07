import type { StructureBeat } from "./db";
import type { Pilar } from "./pilares";

// Estructuras base, compartidas por todas las marcas del editor (user_id NULL).
//
// Cada guía dice QUÉ TIENE QUE CONSEGUIR el bloque, qué debe contener y cómo se
// sabe que funcionó. Nunca una frase de ejemplo: cuando la guía traía muletillas
// ("eso no es lo más loco...", "el que nadie dice"), el modelo las copiaba
// literalmente y después el filtro de la marca castigaba la pieza por usarlas.
// scripts/test-prompt-lint.mjs vigila que eso no vuelva.
//
// Viven aquí y no solo en el seed de scripts/schema.sql porque el seed usa
// ON CONFLICT DO NOTHING y no actualiza las filas ya creadas: la migración
// scripts/migrate-structure-intents.mjs lee de aquí.

/**
 * Ficha de galería: por qué y cuándo usar cada estructura. Se muestra en
 * /estructuras; al modelo solo le llegan las guías de los bloques.
 */
export type StructureFicha = {
  /** Señal de distribución que empuja (Mosseri: watch time, envíos y likes por alcance). */
  senal: string;
  duracion: string;
  cuandoUsar: string;
  /** Tan importante como cuándo sí: el criterio para descartarla. */
  cuandoNo: string;
  porQueFunciona: string;
  /** Formatos de grabación recomendados (ids de lib/executionFormats.ts). */
  formatos: string[];
  /** Familias de gancho que mejor le encajan (ids de lib/angles.ts). */
  familias: string[];
  referentes: string[];
  fuentes: string[];
};

export type BaseStructure = {
  nombre: string;
  descripcion: string;
  pilar: Pilar;
  ficha: StructureFicha;
  beats: StructureBeat[];
};

// Fuentes citadas en las fichas.
const F = {
  vk: "VK Metrics — Formatos Validados de Criativos (creative-formats-vault.lovable.app)",
  mosseri: "Señales de ranking de Instagram reafirmadas por Mosseri: watch time, envíos por alcance y likes por alcance (kompozy.io, blckalpaca.at, 2026)",
  igGuia: "Guía oficial de Reels de Instagram, sept-2026: 3-15 s para piezas rápidas, 15-60 s para tutoriales (socialday.live)",
  hormozi: "Alex Hormozi — intro Proof-Promise-Plan (skool.com, ampifire.com)",
  kane: "Brendan Kane — Hook Point: los formatos son estructuras repetibles, las tendencias caducan",
  sme: "Social Media Examiner — Viral Short-Form Video Formats",
  flowcast: "FlowCast — Instagram Reels hooks that work in 2026: contradicción, lista con giro, precio concreto",
  conversion: "Mapeo de contenido por embudo: casos, objeciones y oferta directa en la parte baja (bizwhat.net, foursixty.com)",
};

export const BASE_STRUCTURES: BaseStructure[] = [
  {
    nombre: "Hook-Lead-Body-Open Loop-CTA",
    descripcion: "Estructura clásica de contenido corto (Reels/TikTok/Shorts) para sostener la retención hasta el final.",
    pilar: "crecimiento",
    ficha: {
      senal: "Watch time y completado: el puente deja una pregunta abierta hasta el final.",
      duracion: "30-45 s",
      cuandoUsar: "Ideas educativas con dos puntos de valor que se pueden encadenar. Es la estructura comodín para descubrimiento.",
      cuandoNo: "Si la idea tiene un solo punto (queda inflada) o si es una historia (usa Storytelling).",
      porQueFunciona: "Separa el valor en dos entregas con un hueco de información en medio: quien vio la primera se queda por la segunda.",
      formatos: ["talking_head", "lofi_movimiento", "green_screen"],
      familias: ["resultado_especifico", "opinion_impopular", "contraste_temporal"],
      referentes: ["Estructura clásica de short-form usada por la mayoría de cuentas educativas"],
      fuentes: [F.mosseri, F.igGuia],
    },
    beats: [
      {
        nombre: "Hook",
        guia: "Consigue que no deslicen en el primer segundo. Entra por el dato, la escena o la afirmación más concreta que tengas, sin preámbulo. Funciona si alguien que no conoce la marca entiende de qué va sin necesitar contexto.",
      },
      {
        nombre: "Lead",
        guia: "Sostiene hasta el segundo 10 explicando por qué esto le toca a quien está mirando. Nombra la situación concreta en la que aparece el problema. Funciona si el espectador se reconoce en ella.",
      },
      {
        nombre: "Body 1",
        guia: "Primera pieza de valor real: algo que el espectador no sabía o no había conectado. Un solo punto, sostenido por un detalle verificable.",
      },
      {
        nombre: "Puente",
        guia: "Enlaza con la idea siguiente dejando algo sin resolver. La curiosidad la crea la información que falta, no una frase de transición: no anuncies que viene lo mejor ni uses muletillas de enganche.",
      },
      {
        nombre: "Body 2",
        guia: "Segunda pieza de valor y remate: cierra lo que el puente dejó abierto y lleva la idea hasta su consecuencia práctica.",
      },
      {
        nombre: "CTA",
        guia: "Una sola acción, la que esta pieza concreta justifica. Si no la justifica, cierra con la pregunta que el espectador ya se está haciendo. Nunca varias acciones a la vez.",
      },
    ],
  },
  {
    nombre: "Storytelling en 3 actos",
    descripcion: "Historia personal o de cliente con arco completo. Ideal para el pilar de adoctrinamiento: casos y resultados.",
    pilar: "adoctrinamiento",
    ficha: {
      senal: "Watch time y likes por alcance entre seguidores: la historia retiene y crea vínculo.",
      duracion: "45-75 s",
      cuandoUsar: "Historias propias o de clientes con un giro real: una decisión, un error, un punto de quiebre.",
      cuandoNo: "Si no hay conflicto concreto (cifras, plazos, decisiones): sin tensión es una anécdota y se cae a los 5 s.",
      porQueFunciona: "Las personas recuerdan historias, no consejos; el giro convierte la experiencia en autoridad sin tener que afirmarla.",
      formatos: ["talking_head", "narrado", "lofi_movimiento", "vlog"],
      familias: ["mini_caso", "contraste_temporal"],
      referentes: ["VK · Depoimento (Leandro Ferrari)", "VK · Vlog (Giullya Becker)"],
      fuentes: [F.vk, F.conversion],
    },
    beats: [
      {
        nombre: "Contexto",
        guia: "Sitúa la escena en 1-2 frases: quién, cuándo y qué estaba en juego. Funciona si el espectador reconoce la situación como propia.",
      },
      {
        nombre: "Conflicto",
        guia: "Dónde se rompió. Aquí vive la tensión: concreta con cifras, plazos o decisiones reales, no con adjetivos.",
      },
      {
        nombre: "Punto de giro",
        guia: "La decisión o el hallazgo que cambió el rumbo. Es la pieza de valor contada como historia, no la moraleja adelantada.",
      },
      {
        nombre: "Resolución",
        guia: "El resultado concreto, solo hasta donde se pueda sostener. Sin exagerar y sin dar a entender que se repite siempre.",
      },
      {
        nombre: "Lección",
        guia: "Lo que se lleva quien no va a comprar nada. Una sola idea, formulada de modo que pueda aplicarla mañana.",
      },
      {
        nombre: "CTA",
        guia: "Una sola acción, coherente con la historia que acaba de contarse.",
      },
    ],
  },
  {
    nombre: "Mito vs Realidad",
    descripcion: "Desmonta una creencia extendida del nicho. Para el pilar de crecimiento: postura, criterio y discusión sana.",
    pilar: "crecimiento",
    ficha: {
      senal: "Envíos y comentarios: corregir una creencia extendida invita a reenviarla a quien la tiene.",
      duracion: "30-45 s",
      cuandoUsar: "Hay una creencia que el cliente ideal repite y que la marca puede desmontar con un dato o caso propio.",
      cuandoNo: "Si no tienes la prueba para la 'realidad': sin dato es opinión contra opinión y resta autoridad.",
      porQueFunciona: "La contradicción rompe la expectativa en el primer segundo y validar primero el mito evita que el espectador se defienda.",
      formatos: ["talking_head", "green_screen", "clon"],
      familias: ["opinion_impopular", "criterio_decision"],
      referentes: ["VK · Mito vs fato (Gabriela Milanez)"],
      fuentes: [F.vk, F.flowcast],
    },
    beats: [
      {
        nombre: "El Mito",
        guia: "Enuncia la creencia tal cual circula, sin ironía. Funciona si quien la sostiene asiente al oírla.",
      },
      {
        nombre: "Por qué se cree",
        guia: "Valida qué la hace razonable: quién la promueve y qué parte de ella es cierta. Esto es lo que da autoridad para desmontarla.",
      },
      {
        nombre: "La Realidad",
        guia: "Qué ocurre de verdad, con el dato, el caso o la experiencia que lo sostiene. Sin algo verificable detrás, este bloque no existe.",
      },
      {
        nombre: "El coste",
        guia: "Qué pierde en concreto quien sigue actuando según el mito: dinero, plazo u opciones que se cierran.",
      },
      {
        nombre: "Qué hacer en su lugar",
        guia: "La alternativa aplicable, en uno o dos pasos. Específica para el caso planteado: si sirve para cualquiera, no sirve.",
      },
      {
        nombre: "CTA",
        guia: "Una sola acción, o la pregunta que abra conversación real sobre el mito.",
      },
    ],
  },
  {
    nombre: "Lista Top-N con giro",
    descripcion: "Tres puntos donde el último cambia la lectura de los anteriores. Alta retención y muy compartible.",
    pilar: "crecimiento",
    ficha: {
      senal: "Guardados y envíos: la lista se guarda y el giro final se comparte.",
      duracion: "25-40 s",
      cuandoUsar: "Tienes tres elementos y el último cambia la lectura de los anteriores.",
      cuandoNo: "Si los tres puntos son del mismo nivel y no hay giro: es una lista más del nicho.",
      porQueFunciona: "La promesa numérica marca cuánto falta (retención) y el giro corrige lo que se esperaba en vez de confirmarlo.",
      formatos: ["talking_head", "texto_pantalla", "bloc_notas"],
      familias: ["criterio_decision", "resultado_especifico"],
      referentes: ["VK · Lista (Maira Martinez)"],
      fuentes: [F.vk, F.flowcast],
    },
    beats: [
      {
        nombre: "Hook",
        guia: "Promete la lista y qué cambia al conocerla. El número que anuncies es exactamente el que entregas. Máximo tres elementos: acumular más suena a alarma, no a criterio.",
      },
      {
        nombre: "Punto 1",
        guia: "El más conocido: establece que dominas el terreno. Breve, sin detenerse.",
      },
      {
        nombre: "Punto 2",
        guia: "Menos obvio que el anterior, con un ejemplo concreto que lo haga tangible.",
      },
      {
        nombre: "Punto final (el giro)",
        guia: "El que cambia la lectura de los dos anteriores: apunta al problema de fondo, no a un truco más. Es el que hace que la compartan.",
      },
      {
        nombre: "CTA",
        guia: "Una sola acción. Si la lista ya dejó algo abierto, basta con esa pregunta.",
      },
    ],
  },
  {
    nombre: "Vídeo largo (5-8 min)",
    descripcion: "Versión larga de una idea que ya funcionó en corto (YouTube o vídeo de autoridad). Profundiza donde el reel solo apuntaba.",
    pilar: "adoctrinamiento",
    ficha: {
      senal: "Tiempo de visionado total y suscripción en YouTube; en Instagram, guardados.",
      duracion: "5-8 min",
      cuandoUsar: "Una idea que ya funcionó en corto y merece método completo (sale sola al Exprimir un ganador).",
      cuandoNo: "Para ideas no probadas: el coste de producción solo se justifica con una idea validada.",
      porQueFunciona: "Profundiza donde el reel solo apuntaba y convierte al espectador ocasional en seguidor que confía.",
      formatos: ["talking_head", "palestrinha", "pizarra"],
      familias: ["resultado_especifico", "mini_caso"],
      referentes: ["Alex Hormozi (intro Prueba-Promesa-Plan en vídeos largos)"],
      fuentes: [F.hormozi],
    },
    beats: [
      {
        nombre: "Hook",
        guia: "Plantea en los primeros 15 segundos el problema y el resultado que se lleva quien se quede hasta el final. Funciona si dice para quién es este vídeo y para quién no.",
      },
      {
        nombre: "Contexto",
        guia: "Por qué este tema importa ahora y qué se suele hacer mal. Apóyate en una situación real o en una cifra concreta, no en generalidades.",
      },
      {
        nombre: "Bloque 1",
        guia: "Primera idea de fondo, desarrollada con un ejemplo paso a paso. Termina con lo que el espectador ya puede aplicar.",
      },
      {
        nombre: "Bloque 2",
        guia: "Segunda idea, más avanzada que la primera: el matiz o la excepción que distingue a quien domina el tema. Con caso propio o de cliente.",
      },
      {
        nombre: "Bloque 3",
        guia: "La pieza que une los dos bloques anteriores en un método o criterio de decisión. Es lo que justifica haber visto la versión larga.",
      },
      {
        nombre: "Errores comunes",
        guia: "Dos o tres errores frecuentes al aplicar lo anterior, cada uno con su consecuencia concreta y cómo evitarlo.",
      },
      {
        nombre: "Cierre y CTA",
        guia: "Resume el método en una frase aplicable y propone una sola acción coherente con el nivel de compromiso que ya generó el vídeo.",
      },
    ],
  },
  // ————————————————— CRECIMIENTO —————————————————
  // Objetivo: llegar a quien no te sigue. Señal que manda: envíos por alcance
  // y watch time. Formatos que se reenvían: verdades reconocibles, criterio
  // que provoca desacuerdo sano, novedad.
  {
    nombre: "Tier list con criterio",
    descripcion: "Clasifica opciones del nicho en niveles con un criterio explícito. Provoca desacuerdo sano: comentarios y envíos.",
    pilar: "crecimiento",
    ficha: {
      senal: "Comentarios y envíos: cada espectador tiene su propio orden y lo defiende o lo reenvía.",
      duracion: "40-60 s",
      cuandoUsar: "El cliente ideal elige entre opciones conocidas (herramientas, estrategias, tipos de oferta) y la marca tiene un criterio propio para ordenarlas.",
      cuandoNo: "Si las opciones son marcas o personas concretas que la marca no puede criticar (línea roja), o si no hay criterio: sin criterio es solo gusto.",
      porQueFunciona: "Clasificar es una toma de postura visible: invita a discrepar sin atacar a nadie y demuestra criterio en pocos segundos.",
      formatos: ["tierlist_visual", "talking_head", "green_screen"],
      familias: ["criterio_decision", "opinion_impopular"],
      referentes: ["VK · Tierlist (Alex Hormozi)", "VK · Ranking (Phill Rocha)"],
      fuentes: [F.vk, F.mosseri],
    },
    beats: [
      {
        nombre: "Promesa y criterio",
        guia: "Anuncia qué se va a clasificar y con qué criterio único se ordena. El criterio va explícito desde el principio: es lo que da autoridad a la clasificación.",
      },
      {
        nombre: "Nivel bajo",
        guia: "Lo que peor puntúa según el criterio y por qué, con una consecuencia concreta para quien lo usa. Sin burla: se juzga la opción, no a quien la elige.",
      },
      {
        nombre: "Nivel medio",
        guia: "Lo que sirve solo en ciertas condiciones. Di en cuáles: es el bloque que demuestra matiz.",
      },
      {
        nombre: "Nivel alto",
        guia: "Lo que mejor puntúa, idealmente una opción que el espectador no esperaba arriba, con la razón que lo justifica.",
      },
      {
        nombre: "Cierre",
        guia: "Invita a que el espectador diga qué movería de nivel y por qué. Una sola pregunta.",
      },
    ],
  },
  {
    nombre: "Nosotros vs ellos (A/B/C)",
    descripcion: "Contrasta la forma habitual de hacer algo con la forma que da resultado. Pone en evidencia un criterio sin atacar a nadie.",
    pilar: "crecimiento",
    ficha: {
      senal: "Envíos: quien se reconoce en la versión A la reenvía; quien ya hace la C la comparte como validación.",
      duracion: "25-45 s",
      cuandoUsar: "Hay una práctica muy extendida en el nicho que la marca hace de otra manera, y la diferencia se puede mostrar en una escena.",
      cuandoNo: "Si la versión A ridiculiza al cliente ideal (se siente atacado y se va) o apunta a un competidor reconocible.",
      porQueFunciona: "El contraste lado a lado se entiende sin sonido y en segundos; la escala de tres niveles (mal, bien, muy bien) evita el blanco o negro y da credibilidad.",
      formatos: ["clon", "talking_head", "texto_pantalla"],
      familias: ["contraste_temporal", "criterio_decision", "pov_realista"],
      referentes: ["VK · Nós vs eles (Luíza Cureau)", "VK · A+B+C (Rony)"],
      fuentes: [F.vk, F.sme],
    },
    beats: [
      {
        nombre: "Escena",
        guia: "Plantea la situación concreta en la que se nota la diferencia. Que se entienda de qué va sin contexto previo.",
      },
      {
        nombre: "Versión habitual",
        guia: "Cómo lo resuelve la mayoría y qué consecuencia tiene. Retrata una práctica, nunca a una persona ni a un competidor.",
      },
      {
        nombre: "Versión correcta",
        guia: "Cómo lo resuelve quien obtiene resultado. Mismo escenario, una sola diferencia de fondo, mostrada en acción.",
      },
      {
        nombre: "La diferencia",
        guia: "Nombra el criterio que separa las dos versiones, de forma que el espectador pueda aplicarlo a su propio caso.",
      },
      {
        nombre: "Cierre",
        guia: "Pregunta en qué versión está el espectador hoy, o una acción única coherente con la pieza.",
      },
    ],
  },
  {
    nombre: "Noticia y qué significa",
    descripcion: "Cuenta un cambio reciente del sector y traduce qué implica para el cliente ideal esta semana. Posiciona como la persona al día.",
    pilar: "crecimiento",
    ficha: {
      senal: "Envíos y watch time: la novedad tiene urgencia propia y se reenvía a quien le afecta.",
      duracion: "30-50 s",
      cuandoUsar: "Hay un cambio real y verificable (plataforma, mercado, herramienta) con menos de una semana y fuente citable.",
      cuandoNo: "Sin fuente verificable, o si la 'noticia' es una suposición: anticipar normas o cambios no confirmados destruye la credibilidad.",
      porQueFunciona: "Llegar primero con la traducción práctica posiciona como referente; la mayoría solo repite el titular.",
      formatos: ["noticiero", "green_screen", "talking_head"],
      familias: ["contraste_temporal", "resultado_especifico"],
      referentes: ["VK · Breaking news (Dylan Page)"],
      fuentes: [F.vk],
    },
    beats: [
      {
        nombre: "Titular",
        guia: "El cambio en una frase, con la fecha y la fuente. Solo hechos verificables: si algo no está confirmado, dilo como no confirmado o no lo uses.",
      },
      {
        nombre: "Qué cambia",
        guia: "Qué es distinto en la práctica a partir de ahora, en términos concretos y sin exagerar el alcance.",
      },
      {
        nombre: "A quién afecta",
        guia: "En qué situación concreta del cliente ideal se nota el cambio y a quién no le afecta.",
      },
      {
        nombre: "Qué hacer",
        guia: "La acción concreta que conviene tomar esta semana, o la decisión que conviene no precipitar.",
      },
    ],
  },
  {
    nombre: "POV realista",
    descripcion: "Una escena del día a día del cliente ideal tan exacta que se reconoce en ella. Pieza corta pensada para reenviarse.",
    pilar: "crecimiento",
    ficha: {
      senal: "Envíos por alcance: las escenas demasiado reales son las que se mandan por DM.",
      duracion: "7-20 s",
      cuandoUsar: "Hay un momento recurrente, incómodo o absurdo de la vida del cliente ideal que la marca conoce de primera mano.",
      cuandoNo: "Si la escena es genérica (le pasa a cualquiera) o si necesita explicación: un POV que se explica ya no funciona.",
      porQueFunciona: "El reconocimiento inmediato ('esto soy yo') es lo que activa el reenvío; la duración corta favorece verlo completo y repetirlo.",
      formatos: ["pov", "texto_pantalla", "stories_nativo"],
      familias: ["pov_realista"],
      referentes: ["VK · POV (Luana Carolina)"],
      fuentes: [F.vk, F.igGuia, F.mosseri],
    },
    beats: [
      {
        nombre: "Situación",
        guia: "Sitúa al espectador en segunda persona en un momento concreto y reconocible de su semana, con un detalle específico que solo conoce quien lo ha vivido.",
      },
      {
        nombre: "El detalle real",
        guia: "La reacción, el pensamiento o la contradicción que todo el mundo tiene en esa escena y nadie admite en voz alta.",
      },
      {
        nombre: "Remate",
        guia: "Un giro breve que cierra la escena: la consecuencia, la ironía o la verdad incómoda. Sin moraleja explicada.",
      },
    ],
  },

  // ————————————————— ADOCTRINAMIENTO —————————————————
  // Objetivo: que quien ya te sigue confíe en ti. Señales: watch time,
  // guardados y likes por alcance (los likes pesan más entre seguidores).
  {
    nombre: "Caso de cliente",
    descripcion: "Antes, decisión y después de un cliente real, con la lección que cualquiera puede aplicar. Prueba de método sin afirmarla.",
    pilar: "adoctrinamiento",
    ficha: {
      senal: "Watch time y guardados; en seguidores, likes por alcance. Es la pieza que más confianza acumula.",
      duracion: "45-75 s",
      cuandoUsar: "Hay un cliente real con un resultado concreto y permiso para contarlo, aunque sea anónimo.",
      cuandoNo: "Si el resultado no se puede sostener con datos o depende de suerte: un caso exagerado se detecta y resta.",
      porQueFunciona: "La prueba de un tercero pesa más que la promesa de la marca, y la lección final hace útil la pieza para quien no compra.",
      formatos: ["talking_head", "meet", "pantalla_real", "testimonio"],
      familias: ["mini_caso", "resultado_especifico"],
      referentes: ["VK · Depoimento (Leandro Ferrari)", "VK · Meet (Marcelo Távora)"],
      fuentes: [F.vk, F.conversion],
    },
    beats: [
      {
        nombre: "Resultado",
        guia: "Abre con el resultado concreto del cliente y el plazo, solo hasta donde se puede sostener con datos.",
      },
      {
        nombre: "Punto de partida",
        guia: "Dónde estaba el cliente antes: la situación y la cifra que el cliente ideal reconoce como propia.",
      },
      {
        nombre: "El error",
        guia: "Qué estaba haciendo que le frenaba. Es el bloque en el que el espectador se identifica.",
      },
      {
        nombre: "La decisión",
        guia: "Qué cambió exactamente: la decisión o el ajuste de método, con detalle suficiente para entenderlo.",
      },
      {
        nombre: "Lección",
        guia: "Lo que se lleva quien no va a contratar nada, y el límite honesto: qué no garantiza este caso.",
      },
    ],
  },
  {
    nombre: "Pizarra: lo que no sabes que no sabes",
    descripcion: "Explica con un esquema el modelo mental que el cliente cree tener resuelto y no tiene. Contenido de vacío de conocimiento.",
    pilar: "adoctrinamiento",
    ficha: {
      senal: "Guardados y watch time: el esquema completo se guarda para consultarlo.",
      duracion: "45-75 s",
      cuandoUsar: "El cliente ideal comete un error porque usa un modelo mental incompleto y la marca puede dibujar el correcto.",
      cuandoNo: "Si el concepto no se puede dibujar en un esquema simple: entonces es una historia o un caso, no una pizarra.",
      porQueFunciona: "Ver construirse el esquema obliga a quedarse hasta el final, y revelar lo que el espectador no sabía que le faltaba crea autoridad.",
      formatos: ["pizarra", "papel_boli", "palestrinha"],
      familias: ["criterio_decision", "opinion_impopular"],
      referentes: ["VK · Quadro branco (Camile Vilela)", "VK · Papel e Caneta (Hudison Miguel)"],
      fuentes: [F.vk],
    },
    beats: [
      {
        nombre: "La pregunta",
        guia: "Plantea la decisión que el cliente ideal cree tener resuelta. Funciona si piensa que ya sabe la respuesta.",
      },
      {
        nombre: "El modelo habitual",
        guia: "Dibuja cómo lo piensa la mayoría y en qué punto concreto se rompe.",
      },
      {
        nombre: "El modelo correcto",
        guia: "Dibuja la pieza que falta y cómo cambia el esquema. Un solo concepto, sostenido por un ejemplo.",
      },
      {
        nombre: "Implicación",
        guia: "Qué decisión cambia mañana para quien entiende el esquema completo.",
      },
    ],
  },
  {
    nombre: "Paso a paso (Prueba-Promesa-Plan)",
    descripcion: "Método aplicable en tres pasos, abierto con prueba, promesa y plan. Para que guarden la pieza y vuelvan a ella.",
    pilar: "adoctrinamiento",
    ficha: {
      senal: "Guardados y completado: el espectador se queda para tener los tres pasos.",
      duracion: "40-60 s",
      cuandoUsar: "La marca tiene un proceso propio que ha aplicado y se puede resumir en tres pasos accionables.",
      cuandoNo: "Si los pasos son obvios o genéricos: un paso a paso que podría publicar cualquiera del nicho no posiciona.",
      porQueFunciona: "La prueba al inicio da credibilidad a la promesa y el plan anunciado reduce el abandono porque el espectador sabe cuánto falta.",
      formatos: ["talking_head", "pantalla_real", "papel_boli"],
      familias: ["resultado_especifico", "mini_caso"],
      referentes: ["VK · Passo a passo (Letícia Vaz)", "Alex Hormozi (Proof-Promise-Plan)"],
      fuentes: [F.vk, F.hormozi],
    },
    beats: [
      {
        nombre: "Prueba-Promesa-Plan",
        guia: "En pocos segundos: la prueba de que el método funciona, lo que obtendrá el espectador y que son tres pasos. Sin preámbulo.",
      },
      {
        nombre: "Paso 1",
        guia: "La primera acción, concreta y aplicable hoy, con el detalle que la hace distinta de la versión genérica.",
      },
      {
        nombre: "Paso 2",
        guia: "La segunda acción, que depende de la primera. Explica por qué va en este orden.",
      },
      {
        nombre: "Paso 3",
        guia: "La última acción, la que cierra el resultado prometido.",
      },
      {
        nombre: "El error que lo arruina",
        guia: "El fallo habitual al aplicar los pasos y cómo evitarlo. Cierra con una sola acción.",
      },
    ],
  },
  {
    nombre: "Detrás de la pantalla",
    descripcion: "Muestra un dato real (panel, resultado, herramienta) y explica qué decisión tomaste por él. La pantalla es la prueba.",
    pilar: "adoctrinamiento",
    ficha: {
      senal: "Watch time: el espectador lee la pantalla mientras escucha. Likes por alcance entre seguidores.",
      duracion: "30-50 s",
      cuandoUsar: "Hay un dato real que se puede enseñar (con permiso) y detrás hay una decisión que el cliente ideal también tiene que tomar.",
      cuandoNo: "Si el dato no se puede mostrar o es presumir sin enseñar nada: la pantalla tiene que traer una lección, no solo una cifra.",
      porQueFunciona: "Mostrar en lugar de afirmar elimina la duda; explicar la decisión convierte la cifra en criterio que el espectador se lleva.",
      formatos: ["pantalla_real", "green_screen", "stories_nativo"],
      familias: ["resultado_especifico", "criterio_decision"],
      referentes: ["VK · Mostrando celular/computador (Marcelo Távora)", "VK · Stories nativo (Marcelo Távora)"],
      fuentes: [F.vk],
    },
    beats: [
      {
        nombre: "El dato",
        guia: "Abre con la pantalla y la cifra o señal concreta que importa. Que se vea antes de explicarlo.",
      },
      {
        nombre: "Contexto",
        guia: "Qué se está viendo y por qué es relevante para alguien en la situación del cliente ideal.",
      },
      {
        nombre: "La lectura",
        guia: "Qué significa ese dato, incluida la interpretación que la mayoría haría mal.",
      },
      {
        nombre: "La decisión",
        guia: "Qué hizo la marca a partir del dato y qué haría el espectador en su caso.",
      },
    ],
  },
  {
    nombre: "Respuesta a una pregunta real",
    descripcion: "Responde la pregunta literal de un seguidor o cliente. Hace comunidad y aprovecha la voz de la audiencia.",
    pilar: "adoctrinamiento",
    ficha: {
      senal: "Comentarios y likes por alcance: invita a preguntar más y quien tiene la misma duda se queda.",
      duracion: "30-45 s",
      cuandoUsar: "Hay una pregunta real (DM, comentario, llamada de venta) que se repite. Usa la voz de la audiencia pegada en Ideas.",
      cuandoNo: "Si la pregunta es inventada o demasiado básica para la marca: se nota y resta autoridad.",
      porQueFunciona: "La pregunta literal en pantalla hace que quien tiene la misma duda se reconozca, y la respuesta pública demuestra cercanía y criterio.",
      formatos: ["caja_preguntas", "talking_head", "lofi_movimiento"],
      familias: ["objecion_real", "criterio_decision"],
      referentes: ["VK · Caixinha de pergunta (Tay Dantas)"],
      fuentes: [F.vk],
    },
    beats: [
      {
        nombre: "La pregunta",
        guia: "Lee la pregunta tal como la escribió la persona, sin maquillarla.",
      },
      {
        nombre: "Respuesta corta",
        guia: "La respuesta directa en una o dos frases, sin rodeos ni depende.",
      },
      {
        nombre: "El porqué",
        guia: "La razón de la respuesta, apoyada en un caso o dato de la marca.",
      },
      {
        nombre: "Matiz",
        guia: "En qué situación concreta la respuesta cambia, para que nadie la aplique mal. Cierra invitando a dejar la siguiente pregunta.",
      },
    ],
  },

  // ————————————————— CONVERSIÓN —————————————————
  // Objetivo: convertir atención en leads o ventas con UNA acción. Señales:
  // comentarios con palabra clave, DMs, clics. Respeta la fase de la marca:
  // si aún no vende, la acción es el recurso o la conversación, no el pago.
  {
    nombre: "Objeción resuelta",
    descripcion: "Toma la objeción literal que frena al cliente ideal, la valida y la desmonta con un caso. Cierra con una acción.",
    pilar: "conversion",
    ficha: {
      senal: "Comentarios con palabra clave y DMs: quien tenía la objeción es exactamente quien está cerca de decidir.",
      duracion: "40-60 s",
      cuandoUsar: "Conoces la objeción real (de llamadas de venta, DMs o comentarios) que frena la decisión.",
      cuandoNo: "Si la objeción es inventada o si la respuesta exige prometer resultados: mejor un caso de cliente.",
      porQueFunciona: "Atacar la duda antes de que el cliente la diga reduce la fricción de la decisión; validar primero evita que se sienta corregido.",
      formatos: ["talking_head", "clon", "caja_preguntas"],
      familias: ["objecion_real", "mini_caso"],
      referentes: ["VK · Clone (Luíza Cureau)", "Mapeo de objeciones en contenido de conversión"],
      fuentes: [F.vk, F.conversion],
    },
    beats: [
      {
        nombre: "La objeción",
        guia: "Di la objeción tal como la dice el cliente ideal, con sus palabras.",
      },
      {
        nombre: "Por qué es razonable",
        guia: "Reconoce qué parte de la objeción es cierta. Es lo que hace que el espectador siga escuchando.",
      },
      {
        nombre: "Lo que cambia la lectura",
        guia: "El dato, el caso o la distinción que muestra por qué la objeción no aplica en su situación.",
      },
      {
        nombre: "Para quién sí y para quién no",
        guia: "Delimita con honestidad a quién le sirve dar el paso y a quién no. Esto es lo que da credibilidad a la invitación.",
      },
      {
        nombre: "Acción",
        guia: "Una sola acción concreta y coherente con la fase de la marca: comentar una palabra, escribir por DM o pedir el recurso.",
      },
    ],
  },
  {
    nombre: "Mini-clase con invitación",
    descripcion: "Enseña una parte completa y útil del método y ofrece el siguiente paso para quien quiera el resto.",
    pilar: "conversion",
    ficha: {
      senal: "Comentarios con palabra clave y guardados: quien aprendió algo útil pide más.",
      duracion: "45-75 s",
      cuandoUsar: "La marca tiene un recurso, evento o servicio que continúa de forma natural lo que se enseña.",
      cuandoNo: "Si se guarda lo importante para obligar a pedir el recurso: el espectador lo nota y no vuelve.",
      porQueFunciona: "Dar primero una pieza completa demuestra que el siguiente paso vale la pena; la invitación se percibe como continuación, no como venta.",
      formatos: ["palestrinha", "pizarra", "talking_head"],
      familias: ["resultado_especifico", "criterio_decision"],
      referentes: ["VK · Palestrinha (Marcelo Távora)"],
      fuentes: [F.vk],
    },
    beats: [
      {
        nombre: "Promesa",
        guia: "Qué va a saber hacer el espectador al terminar, concreto y alcanzable en lo que dura la pieza.",
      },
      {
        nombre: "La enseñanza",
        guia: "Una parte del método completa y aplicable por sí sola, con un ejemplo concreto. No se esconde lo importante.",
      },
      {
        nombre: "Lo que no cabe aquí",
        guia: "Nombra con honestidad qué parte del proceso no cabe en un vídeo corto y por qué importa.",
      },
      {
        nombre: "Invitación",
        guia: "Una sola acción para recibir el siguiente paso, dicha con claridad: qué hacer y qué recibe.",
      },
    ],
  },
  {
    nombre: "Invitación directa (Prueba-Promesa-Plan)",
    descripcion: "Oferta clara de un recurso, evento o servicio: prueba, promesa, qué incluye, para quién no es y una acción.",
    pilar: "conversion",
    ficha: {
      senal: "Clics, DMs y comentarios con palabra clave. Es la pieza que convierte la confianza ya ganada.",
      duracion: "30-45 s",
      cuandoUsar: "Hay algo concreto que ofrecer y la audiencia ya conoce a la marca por piezas de crecimiento y adoctrinamiento.",
      cuandoNo: "En una cuenta sin audiencia calentada, o si la oferta no existe todavía: primero crecimiento y adoctrinamiento.",
      porQueFunciona: "La prueba crea receptividad para la promesa y el plan quita la última objeción: qué pasa exactamente después de actuar.",
      formatos: ["talking_head", "stories_nativo", "congelada"],
      familias: ["resultado_especifico", "objecion_real"],
      referentes: ["Alex Hormozi (Proof-Promise-Plan)"],
      fuentes: [F.hormozi, F.conversion],
    },
    beats: [
      {
        nombre: "Prueba",
        guia: "El resultado o la evidencia que respalda la oferta, sostenible con datos.",
      },
      {
        nombre: "Promesa",
        guia: "Qué obtiene quien actúe, formulado como algo que la marca puede cumplir. Sin garantías de ingresos.",
      },
      {
        nombre: "Plan",
        guia: "Qué incluye y qué pasa exactamente después de dar el paso.",
      },
      {
        nombre: "Para quién no es",
        guia: "Descarta con claridad a quien no le conviene: filtra y da credibilidad.",
      },
      {
        nombre: "Acción",
        guia: "Una sola acción, concreta y repetida en texto en pantalla.",
      },
    ],
  },
  {
    nombre: "Dos caminos",
    descripcion: "Compara con honestidad hacerlo por su cuenta frente a hacerlo con ayuda: coste, tiempo y riesgo de cada camino.",
    pilar: "conversion",
    ficha: {
      senal: "DMs y comentarios de quien está decidiendo; guardados de quien aún compara.",
      duracion: "40-60 s",
      cuandoUsar: "El cliente ideal está decidiendo si resolverlo solo o con un servicio, y ambos caminos son legítimos.",
      cuandoNo: "Si se caricaturiza el camino solo: el espectador que lo está intentando se siente atacado y se va.",
      porQueFunciona: "Reconocer que el camino solo es válido hace creíble la recomendación; poner coste y tiempo en cada lado facilita la decisión.",
      formatos: ["talking_head", "clon", "pizarra"],
      familias: ["criterio_decision", "contraste_temporal"],
      referentes: ["VK · Nós vs eles (Luíza Cureau), aplicado a la decisión de compra"],
      fuentes: [F.vk, F.conversion],
    },
    beats: [
      {
        nombre: "La decisión",
        guia: "Plantea la decisión que el cliente ideal tiene delante, en sus términos.",
      },
      {
        nombre: "Camino por su cuenta",
        guia: "Qué exige hacerlo solo: tiempo, coste y riesgo, con respeto y sin caricatura. Di para quién es la mejor opción.",
      },
      {
        nombre: "Camino con ayuda",
        guia: "Qué cambia con ayuda: qué se ahorra y qué sigue dependiendo del cliente.",
      },
      {
        nombre: "Cómo elegir",
        guia: "El criterio concreto para decidir entre los dos y una sola acción para quien elija el segundo.",
      },
    ],
  },
];
