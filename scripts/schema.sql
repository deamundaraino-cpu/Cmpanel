-- Esquema multi-cliente de Brandpanel para Supabase Postgres.
-- Idempotente: se puede ejecutar varias veces sin romper nada.
-- Las fechas se guardan como TEXT ISO (igual que en SQLite) para no tocar la lógica de la app.
--
-- Tenancy: un usuario (editor/agencia) gestiona N clientes; TODO el contenido
-- (posts, ideas, propuestas, campañas…) cuelga de clients.id. Las estructuras
-- de guion y la cuota de IA son del usuario (compartidas entre sus clientes).
--
-- Para migrar una base multi-tenant por usuario (v2) usa scripts/migrate-clients.mjs
-- (este archivo asume instalación limpia; CREATE TABLE IF NOT EXISTS no altera tablas viejas).

-- ————— Usuarios (espejo de auth.users para joins con postgres.js) —————

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  ai_daily_limit INTEGER,
  onboarded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT now()::text
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ————— Clientes: el límite de tenancy del contenido —————

CREATE TABLE IF NOT EXISTS clients (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT now()::text,
  nombre TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3987e5',
  estado TEXT NOT NULL DEFAULT 'activo',
  last_synced_at TEXT
);

-- ————— Cuotas de IA por usuario y día (compartidas entre sus clientes) —————

CREATE TABLE IF NOT EXISTS ai_usage (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  kind TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date, kind)
);

-- ————— Datos por cliente —————

CREATE TABLE IF NOT EXISTS settings (
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (client_id, key)
);

CREATE TABLE IF NOT EXISTS posts (
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
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
  campaign_id BIGINT,
  PRIMARY KEY (client_id, id)
);

CREATE TABLE IF NOT EXISTS account_snapshots (
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  followers_count INTEGER,
  media_count INTEGER,
  PRIMARY KEY (client_id, date)
);

CREATE TABLE IF NOT EXISTS recommendations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  content TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ideas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
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
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  post_id TEXT,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente',
  formato TEXT,
  slides TEXT,
  caption TEXT,
  hashtags TEXT,
  structure_id BIGINT,
  quality INTEGER,
  quality_notes TEXT,
  share_token TEXT UNIQUE,
  client_feedback TEXT
);

-- structures: librería del EDITOR (user_id), compartida entre sus clientes.
-- user_id NULL = plantilla builtin global visible para todos.
CREATE TABLE IF NOT EXISTS structures (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  beats TEXT NOT NULL,
  is_builtin INTEGER DEFAULT 0,
  CONSTRAINT structures_user_nombre_uni UNIQUE NULLS NOT DISTINCT (user_id, nombre)
);

CREATE TABLE IF NOT EXISTS campaigns (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
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
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
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
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  period_days INTEGER NOT NULL,
  content TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stories (
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
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
  last_synced TEXT,
  PRIMARY KEY (client_id, id)
);

CREATE TABLE IF NOT EXISTS comments (
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  text TEXT,
  like_count INTEGER DEFAULT 0,
  timestamp TEXT,
  last_synced TEXT,
  PRIMARY KEY (client_id, id)
);

-- ————— Índices por tenant —————

CREATE INDEX IF NOT EXISTS idx_clients_owner ON clients (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_posts_client_ts ON posts (client_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_stories_client_ts ON stories (client_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_comments_client_post ON comments (client_id, post_id);
CREATE INDEX IF NOT EXISTS idx_calendar_client_fecha ON calendar_items (client_id, fecha);
CREATE INDEX IF NOT EXISTS idx_ideas_client ON ideas (client_id);
CREATE INDEX IF NOT EXISTS idx_proposals_client_status ON proposals (client_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_client ON campaigns (client_id);
CREATE INDEX IF NOT EXISTS idx_reports_client ON reports (client_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_client ON recommendations (client_id);
CREATE INDEX IF NOT EXISTS idx_structures_user ON structures (user_id);

-- ————— RLS sin políticas: deny-all para PostgREST/anon key —————
-- (la app entra por el pooler con rol privilegiado y no se ve afectada;
--  la tenancy real es el WHERE client_id en cada query)

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- ————— Seed de estructuras de guion builtin (globales, user_id NULL) —————

INSERT INTO structures (created_at, user_id, nombre, descripcion, beats, is_builtin)
VALUES
(
  now()::text,
  NULL,
  'Hook-Lead-Body-Open Loop-CTA',
  'Estructura clásica de contenido corto (Reels/TikTok/Shorts) para maximizar la retención hasta el final.',
  '[{"nombre":"Hook","guia":"Rompe el patrón de lo que están viendo. 1-2 segundos, sin rodeos, va directo al golpe."},{"nombre":"Lead","guia":"Tira de ellos hasta el segundo 10. Una vez anclados aquí, ya no se van a ir."},{"nombre":"Body 1","guia":"Introduce la primera pieza de valor real."},{"nombre":"Open Loop 1","guia":"Crea más curiosidad para que sigan viendo. Ej: \"eso no es lo más loco...\", \"y curiosamente...\""},{"nombre":"Body 2","guia":"Segunda pieza de valor."},{"nombre":"Open Loop 2","guia":"Repite el patrón del open loop anterior con otra promesa."},{"nombre":"Body 3","guia":"Tercera pieza de valor / remate del contenido."},{"nombre":"CTA","guia":"Lleva a tus espectadores más \"calientes\" al siguiente paso. Ej: \"comenta X para...\""}]',
  1
),
(
  now()::text,
  NULL,
  'Storytelling en 3 actos',
  'Historia personal o de cliente con arco completo. Ideal para el pilar de adoctrinamiento: casos de éxito y resultados.',
  '[{"nombre":"Contexto","guia":"Sitúa la escena en 1-2 frases: quién, cuándo, qué estaba en juego. Que se reconozcan en la situación."},{"nombre":"Conflicto","guia":"Qué salió mal o qué muro apareció. Aquí vive la tensión: sé específico con números y emociones."},{"nombre":"Punto de giro","guia":"El descubrimiento o decisión que cambió todo. Es la pieza de valor disfrazada de historia."},{"nombre":"Resolución","guia":"El resultado concreto (métricas, antes/después) sin exagerar ni prometer."},{"nombre":"Lección","guia":"La moraleja accionable que el espectador se lleva aunque no compre nada."},{"nombre":"CTA","guia":"Invita al siguiente paso relacionado con la historia (comenta X, guarda, sígueme para más casos)."}]',
  1
),
(
  now()::text,
  NULL,
  'Mito vs Realidad',
  'Desmonta una creencia extendida del nicho. Perfecto para el pilar de crecimiento: opiniones, polémica sana y romper mitos.',
  '[{"nombre":"El Mito","guia":"Enuncia la creencia popular tal cual la repite todo el mundo. Que asientan con la cabeza."},{"nombre":"Por qué se cree","guia":"Valida por qué tiene sentido creerlo (quién lo promueve, qué lo hace atractivo). Esto te gana credibilidad."},{"nombre":"La Realidad","guia":"El golpe: qué pasa de verdad, con datos, ejemplos o experiencia propia."},{"nombre":"El coste","guia":"Qué pierde quien sigue actuando según el mito (dinero, tiempo, oportunidades)."},{"nombre":"Qué hacer en su lugar","guia":"La alternativa práctica en 1-2 pasos concretos."},{"nombre":"CTA","guia":"Pregunta polémica o invitación a comentar su experiencia con el mito."}]',
  1
),
(
  now()::text,
  NULL,
  'Lista Top-N con giro',
  'Lista de N puntos donde el último rompe el patrón. Retención alta y muy compartible. Sirve para crecimiento y conversión.',
  '[{"nombre":"Hook","guia":"Promete la lista con un beneficio claro: \"Los N errores/claves/señales que...\". Anuncia que el último es el que nadie dice."},{"nombre":"Punto 1","guia":"El más conocido de la lista: valida que sabes de qué hablas."},{"nombre":"Punto 2","guia":"Sube el nivel: algo menos obvio, con un ejemplo rápido."},{"nombre":"Punto 3","guia":"Algo contraintuitivo que genere \"no lo había pensado\"."},{"nombre":"Punto final (el giro)","guia":"El que rompe el patrón: contradice lo esperado o apunta al problema real de fondo. Es el que hace compartir."},{"nombre":"CTA","guia":"Guarda esta lista / comenta cuál te está frenando / comenta la palabra clave para el recurso."}]',
  1
)
ON CONFLICT (user_id, nombre) DO NOTHING;
