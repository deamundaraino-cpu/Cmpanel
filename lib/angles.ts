// Familias de gancho, para que dos piezas seguidas de la misma marca no entren
// por el mismo sitio.
//
// Cada familia se describe por su FUNCIÓN y por el criterio que debe cumplir el
// texto, nunca con una frase de muestra. La instrucción de portadas enumeraba
// ejemplos literales ("3 errores que…", "nadie te dice esto…") y el resultado
// fueron portadas clonadas entre piezas: el modelo copia lo que se le enseña.
//
// El orden del catálogo importa: es el que se sigue cuando la marca todavía no
// tiene histórico.

export type HookFamily = {
  id: string;
  nombre: string;
  /** Qué consigue este gancho en el primer segundo. */
  objetivo: string;
  /** Qué tiene que haber en el texto para que sea de esta familia. */
  debeContener: string;
  /** Señal de que el texto se salió de la familia. */
  descarta: string;
};

export const HOOK_FAMILIES: HookFamily[] = [
  {
    id: "resultado_especifico",
    nombre: "Resultado específico",
    objetivo: "Nombrar de entrada el resultado concreto que está en juego, con una magnitud verificable.",
    debeContener: "una cifra, un plazo o una cantidad real del caso; nunca una cifra inventada para que suene mejor.",
    descarta: "si el número podría cambiarse por otro sin que la frase pierda nada, no es esta familia.",
  },
  {
    id: "opinion_impopular",
    nombre: "Opinión impopular",
    objetivo: "Tomar una postura que una parte de la audiencia rechaza de entrada, y sostenerla.",
    debeContener: "una afirmación con la que se pueda estar en desacuerdo, dicha sin rodeos ni matices defensivos.",
    descarta: "si nadie razonable puede discrepar, no es esta familia: es una obviedad.",
  },
  {
    id: "objecion_real",
    nombre: "Objeción del cliente",
    objetivo: "Empezar por la frase que el cliente ideal dice de verdad cuando se resiste.",
    debeContener: "la objeción tal y como la formularía él, en sus palabras, no en las de la marca.",
    descarta: "si suena a cómo lo describiría un vendedor, no es esta familia.",
  },
  {
    id: "criterio_decision",
    nombre: "Error de criterio",
    objetivo: "Señalar la decisión concreta donde la gente se equivoca, no el error genérico.",
    debeContener: "el momento exacto en que se toma esa decisión: qué se firma, qué se elige, ante quién.",
    descarta: "si el error vale para cualquiera en cualquier sector, no es esta familia.",
  },
  {
    id: "mini_caso",
    nombre: "Mini caso",
    objetivo: "Abrir con una situación real comprimida en una frase, que el espectador reconozca.",
    debeContener: "un sujeto concreto y un detalle que solo aparece cuando algo se ha vivido de cerca.",
    descarta: "si podría ser un caso inventado, le falta el detalle que lo hace real.",
  },
  {
    id: "pov_realista",
    nombre: "POV realista",
    objetivo: "Poner al espectador dentro de la escena en la que el problema aparece.",
    debeContener: "el lugar, el momento o el interlocutor de esa escena; lo que está viendo u oyendo.",
    descarta: "si no hay escena y solo hay concepto, no es esta familia.",
  },
  {
    id: "contraste_temporal",
    nombre: "Contraste temporal",
    objetivo: "Enfrentar lo que se decidió entonces con lo que se sostiene ahora.",
    debeContener: "dos momentos identificables y qué cambió entre ellos.",
    descarta: "si no se puede señalar qué cambió, no es esta familia.",
  },
];

/** Lo que el mercado premia hoy en el primer segundo, sin dictar frases. */
export const HOOK_BAR = `El gancho se juega en el primer segundo: si alguien que no conoce la marca no lo entiende sin contexto, no sirve. Prefiere siempre lo concreto —una cifra, un objeto, un momento— a la categoría abstracta. Y no reutilices patrones de gancho que ya circulan en el nicho: el formato reconocible se penaliza, no se premia.`;

export function familyById(id: string | null | undefined): HookFamily | undefined {
  return HOOK_FAMILIES.find((f) => f.id === id);
}

/**
 * Las `n` familias menos usadas recientemente. `recientes` viene de la más nueva
 * a la más antigua; una familia que no aparece es la que más lejos queda.
 */
export function pickHookFamilies(recientes: (string | null)[], n = 1): HookFamily[] {
  const usadas = recientes.filter((r): r is string => !!r);
  const distancia = (f: HookFamily) => {
    const i = usadas.indexOf(f.id);
    return i === -1 ? Number.POSITIVE_INFINITY : i;
  };
  return [...HOOK_FAMILIES]
    .map((f, orden) => ({ f, orden, d: distancia(f) }))
    .sort((a, b) => (b.d === a.d ? a.orden - b.orden : b.d - a.d))
    .slice(0, Math.max(1, n))
    .map((x) => x.f);
}

/** Bloque para el prompt: una sola familia, descrita por su función. */
export function hookFamilyInstruction(f: HookFamily): string {
  return `\n\nFAMILIA DE GANCHO PARA ESTA PIEZA: ${f.nombre}.\n- Objetivo: ${f.objetivo}\n- Debe contener: ${f.debeContener}\n- Cómo saber que fallaste: ${f.descarta}\n${HOOK_BAR}`;
}
