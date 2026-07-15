-- Esquema de Brandpanel para Supabase Postgres.
-- Idempotente: se puede ejecutar varias veces sin romper nada.
-- Las fechas se guardan como TEXT ISO (igual que en SQLite) para no tocar la lógica de la app.

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  caption TEXT,
  media_type TEXT,
  media_product_type TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  permalink TEXT,
  timestamp TEXT,
  like_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  saved INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  total_interactions INTEGER DEFAULT 0,
  er DOUBLE PRECISION DEFAULT 0,
  score DOUBLE PRECISION,
  is_winner INTEGER DEFAULT 0,
  is_demo INTEGER DEFAULT 0,
  last_synced TEXT,
  campaign_id BIGINT
);

CREATE TABLE IF NOT EXISTS account_snapshots (
  date TEXT PRIMARY KEY,
  followers_count INTEGER,
  media_count INTEGER
);

CREATE TABLE IF NOT EXISTS recommendations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TEXT NOT NULL,
  content TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ideas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TEXT NOT NULL,
  tema TEXT NOT NULL,
  angulo TEXT,
  formato TEXT,
  razon TEXT,
  fuentes TEXT,
  pilar TEXT
);

CREATE TABLE IF NOT EXISTS proposals (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id TEXT,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente',
  formato TEXT,
  slides TEXT,
  caption TEXT,
  hashtags TEXT,
  structure_id BIGINT,
  quality INTEGER,
  quality_notes TEXT
);

CREATE TABLE IF NOT EXISTS structures (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TEXT NOT NULL,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  beats TEXT NOT NULL,
  is_builtin INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS campaigns (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TEXT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  color TEXT DEFAULT '#3987e5',
  fecha_inicio TEXT,
  fecha_fin TEXT,
  estado TEXT NOT NULL DEFAULT 'activa'
);

CREATE TABLE IF NOT EXISTS calendar_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TEXT NOT NULL,
  fecha TEXT NOT NULL,
  titulo TEXT NOT NULL,
  formato TEXT,
  estado TEXT NOT NULL DEFAULT 'idea',
  campaign_id BIGINT,
  proposal_id BIGINT,
  notas TEXT
);

CREATE TABLE IF NOT EXISTS reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TEXT NOT NULL,
  period_days INTEGER NOT NULL,
  content TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  timestamp TEXT,
  media_type TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  caption TEXT,
  views INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  total_interactions INTEGER DEFAULT 0,
  exits INTEGER DEFAULT 0,
  taps_forward INTEGER DEFAULT 0,
  taps_back INTEGER DEFAULT 0,
  last_synced TEXT
);

-- Nueva en esta fase: comentarios de posts para minería de ideas
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  text TEXT,
  like_count INTEGER DEFAULT 0,
  timestamp TEXT,
  last_synced TEXT
);

-- ————— Seed de estructuras de guion builtin (idempotente por nombre único) —————

INSERT INTO structures (created_at, nombre, descripcion, beats, is_builtin)
VALUES
(
  now()::text,
  'Hook-Lead-Body-Open Loop-CTA',
  'Estructura clásica de contenido corto (Reels/TikTok/Shorts) para maximizar la retención hasta el final.',
  '[{"nombre":"Hook","guia":"Rompe el patrón de lo que están viendo. 1-2 segundos, sin rodeos, va directo al golpe."},{"nombre":"Lead","guia":"Tira de ellos hasta el segundo 10. Una vez anclados aquí, ya no se van a ir."},{"nombre":"Body 1","guia":"Introduce la primera pieza de valor real."},{"nombre":"Open Loop 1","guia":"Crea más curiosidad para que sigan viendo. Ej: \"eso no es lo más loco...\", \"y curiosamente...\""},{"nombre":"Body 2","guia":"Segunda pieza de valor."},{"nombre":"Open Loop 2","guia":"Repite el patrón del open loop anterior con otra promesa."},{"nombre":"Body 3","guia":"Tercera pieza de valor / remate del contenido."},{"nombre":"CTA","guia":"Lleva a tus espectadores más \"calientes\" al siguiente paso. Ej: \"comenta X para...\""}]',
  1
),
(
  now()::text,
  'Storytelling en 3 actos',
  'Historia personal o de cliente con arco completo. Ideal para el pilar de adoctrinamiento: casos de éxito y resultados.',
  '[{"nombre":"Contexto","guia":"Sitúa la escena en 1-2 frases: quién, cuándo, qué estaba en juego. Que se reconozcan en la situación."},{"nombre":"Conflicto","guia":"Qué salió mal o qué muro apareció. Aquí vive la tensión: sé específico con números y emociones."},{"nombre":"Punto de giro","guia":"El descubrimiento o decisión que cambió todo. Es la pieza de valor disfrazada de historia."},{"nombre":"Resolución","guia":"El resultado concreto (métricas, antes/después) sin exagerar ni prometer."},{"nombre":"Lección","guia":"La moraleja accionable que el espectador se lleva aunque no compre nada."},{"nombre":"CTA","guia":"Invita al siguiente paso relacionado con la historia (comenta X, guarda, sígueme para más casos)."}]',
  1
),
(
  now()::text,
  'Mito vs Realidad',
  'Desmonta una creencia extendida del nicho. Perfecto para el pilar de crecimiento: opiniones, polémica sana y romper mitos.',
  '[{"nombre":"El Mito","guia":"Enuncia la creencia popular tal cual la repite todo el mundo. Que asientan con la cabeza."},{"nombre":"Por qué se cree","guia":"Valida por qué tiene sentido creerlo (quién lo promueve, qué lo hace atractivo). Esto te gana credibilidad."},{"nombre":"La Realidad","guia":"El golpe: qué pasa de verdad, con datos, ejemplos o experiencia propia."},{"nombre":"El coste","guia":"Qué pierde quien sigue actuando según el mito (dinero, tiempo, oportunidades)."},{"nombre":"Qué hacer en su lugar","guia":"La alternativa práctica en 1-2 pasos concretos."},{"nombre":"CTA","guia":"Pregunta polémica o invitación a comentar su experiencia con el mito."}]',
  1
),
(
  now()::text,
  'Lista Top-N con giro',
  'Lista de N puntos donde el último rompe el patrón. Retención alta y muy compartible. Sirve para crecimiento y conversión.',
  '[{"nombre":"Hook","guia":"Promete la lista con un beneficio claro: \"Los N errores/claves/señales que...\". Anuncia que el último es el que nadie dice."},{"nombre":"Punto 1","guia":"El más conocido de la lista: valida que sabes de qué hablas."},{"nombre":"Punto 2","guia":"Sube el nivel: algo menos obvio, con un ejemplo rápido."},{"nombre":"Punto 3","guia":"Algo contraintuitivo que genere \"no lo había pensado\"."},{"nombre":"Punto final (el giro)","guia":"El que rompe el patrón: contradice lo esperado o apunta al problema real de fondo. Es el que hace compartir."},{"nombre":"CTA","guia":"Guarda esta lista / comenta cuál te está frenando / comenta la palabra clave para el recurso."}]',
  1
)
ON CONFLICT (nombre) DO NOTHING;
