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

-- ————— Configuración global de la plataforma (solo super admin) —————
-- Overrides de la IA (llm_provider/llm_api_key/llm_model/llm_base_url,
-- tavily_api_key); sin fila = se usan las variables de entorno.

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

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
  -- Rendimiento frente a la mediana de la cuenta (×N): detecta pruebas ganadoras.
  perf_ratio DOUBLE PRECISION,
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
  pilar TEXT,
  -- JSON {tipo: ganador|comentarios|tendencia|formato, detalle} — el dato real
  -- de la cuenta en el que se basa la idea (los "recibos" de la IA).
  evidencia TEXT,
  -- Marcas de uso: ya se creó contenido de esta idea en ese formato
  -- (automático al generar la propuesta, o a mano desde /ideas).
  usado_video BOOLEAN NOT NULL DEFAULT FALSE,
  usado_carrusel BOOLEAN NOT NULL DEFAULT FALSE,
  -- Búsqueda v2: afirmación concreta, aperturas posibles (JSON string[]),
  -- etapa del cliente (consciencia|consideracion|decision), descarte manual
  -- ("No me sirve", se pasa a la IA como "esto no") y variante de otra idea.
  tesis TEXT,
  ganchos TEXT,
  etapa TEXT,
  descartada BOOLEAN NOT NULL DEFAULT FALSE,
  parent_id BIGINT REFERENCES ideas(id) ON DELETE SET NULL
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
  client_feedback TEXT,
  -- Trazabilidad de pilar: de qué idea salió y a qué pilar pertenece,
  -- para poder medir la mezcla real de contenido producido.
  pilar TEXT,
  idea_id BIGINT REFERENCES ideas(id) ON DELETE SET NULL,
  -- Ejemplos que el editor marca a mano para que la IA los imite.
  is_exemplar BOOLEAN NOT NULL DEFAULT FALSE,
  -- Familia de gancho con la que se escribió (lib/angles.ts): permite rotar
  -- entre piezas y, más adelante, medir cuál rinde.
  hook_family TEXT,
  -- 'exprimir' cuando la propuesta nace de exprimir un post ganador.
  origen TEXT
);

-- lead_counts: leads captados por semana, introducidos a mano. Es el único
-- dato de negocio real (Instagram no lo expone) y alimenta los informes.
CREATE TABLE IF NOT EXISTS lead_counts (
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  week_start TEXT NOT NULL, -- lunes de la semana, YYYY-MM-DD
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (client_id, week_start)
);

-- hooks: ganchos que YA funcionaron (post ganador salido de propuesta aprobada).
-- Por CLIENTE, no por editor: un gancho pertenece a la voz de esa marca.
CREATE TABLE IF NOT EXISTS hooks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  texto TEXT NOT NULL,
  formato TEXT,
  source_post_id TEXT,
  source_proposal_id BIGINT,
  er DOUBLE PRECISION,
  origen TEXT, -- '@handle' si se guardó desde un referente (no es ganador propio)
  CONSTRAINT hooks_client_proposal_uni UNIQUE (client_id, source_proposal_id)
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
  -- Ámbito: NULL = disponible para todas las marcas del editor; con valor,
  -- solo aparece en esa marca (cada cliente tiene su forma de guionizar).
  client_id BIGINT REFERENCES clients(id) ON DELETE CASCADE,
  -- Galería: pilar de contenido y ficha JSON (señal, cuándo sí/no, formatos,
  -- referentes, fuentes). Las base vienen de lib/baseStructures.ts.
  pilar TEXT,
  ficha TEXT,
  CONSTRAINT structures_user_cliente_nombre_uni UNIQUE NULLS NOT DISTINCT (user_id, client_id, nombre)
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

-- recording_sessions: días de grabación por lotes (las piezas apuntan aquí).
CREATE TABLE IF NOT EXISTS recording_sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  fecha TEXT NOT NULL,
  notas TEXT,
  estado TEXT NOT NULL DEFAULT 'planificada' -- planificada | hecha
);

-- Estados (lib/pipelineStates.ts): idea → por_grabar → grabado → en_edicion
-- → revision → listo → publicado. Los carruseles se saltan la grabación.
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
  notas TEXT,
  pilar TEXT,
  version TEXT, -- corto | largo
  parent_item_id BIGINT REFERENCES calendar_items(id) ON DELETE SET NULL, -- pieza gemela
  fecha_entrega TEXT, -- entrega de edición
  brief_edicion TEXT,
  entrega_url TEXT, -- vídeo/diseño entregado (Drive, etc.)
  session_id BIGINT REFERENCES recording_sessions(id) ON DELETE SET NULL,
  es_prueba BOOLEAN NOT NULL DEFAULT FALSE,
  post_id TEXT -- post de IG en el que se publicó
);

-- referentes: cuentas de referencia/competencia, cargadas a mano por cliente.
CREATE TABLE IF NOT EXISTS referentes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  handle TEXT NOT NULL,
  nombre TEXT,
  notas TEXT
);

-- referente_piezas: posts de un referente pegados a mano (caption o
-- transcripción + números opcionales). analisis = JSON de la IA.
CREATE TABLE IF NOT EXISTS referente_piezas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  referente_id BIGINT NOT NULL REFERENCES referentes(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  url TEXT,
  formato TEXT,
  texto TEXT NOT NULL,
  vistas INTEGER,
  likes INTEGER,
  comentarios INTEGER,
  analisis TEXT
);

CREATE TABLE IF NOT EXISTS reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  period_days INTEGER NOT NULL,
  content TEXT NOT NULL,
  share_token TEXT UNIQUE
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
  username TEXT,           -- autor; null si el token no tiene permiso de comentarios
  is_lead INTEGER DEFAULT 0,
  nota TEXT,
  PRIMARY KEY (client_id, id)
);

-- ————— Índices por tenant —————

CREATE INDEX IF NOT EXISTS idx_clients_owner ON clients (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_posts_client_ts ON posts (client_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_stories_client_ts ON stories (client_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_comments_client_post ON comments (client_id, post_id);
CREATE INDEX IF NOT EXISTS idx_hooks_client ON hooks (client_id);
CREATE INDEX IF NOT EXISTS idx_calendar_client_fecha ON calendar_items (client_id, fecha);
CREATE INDEX IF NOT EXISTS idx_ideas_client ON ideas (client_id);
CREATE INDEX IF NOT EXISTS idx_proposals_client_status ON proposals (client_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_client ON campaigns (client_id);
CREATE INDEX IF NOT EXISTS idx_reports_client ON reports (client_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_client ON recommendations (client_id);
CREATE INDEX IF NOT EXISTS idx_structures_user ON structures (user_id);
CREATE INDEX IF NOT EXISTS idx_recording_sessions_client ON recording_sessions (client_id, fecha);
CREATE INDEX IF NOT EXISTS idx_referentes_client ON referentes (client_id);
CREATE INDEX IF NOT EXISTS idx_referente_piezas_ref ON referente_piezas (client_id, referente_id);

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
ALTER TABLE hooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referente_piezas ENABLE ROW LEVEL SECURITY;

-- ————— Seed de estructuras de guion builtin (globales, user_id NULL) —————
-- Fuente de verdad: lib/baseStructures.ts. Este seed solo crea las filas que
-- faltan (ON CONFLICT DO NOTHING): para actualizar las existentes se usa
-- scripts/migrate-structure-intents.mjs. La galería completa por pilar (con
-- pilar y ficha) la siembra scripts/migrate-production-system.mjs: en una
-- instalación nueva, ejecutarlo después de este archivo.

INSERT INTO structures (created_at, user_id, nombre, descripcion, beats, is_builtin)
VALUES
(
  now()::text,
  NULL,
  'Hook-Lead-Body-Open Loop-CTA',
  'Estructura clásica de contenido corto (Reels/TikTok/Shorts) para sostener la retención hasta el final.',
  '[{"nombre":"Hook","guia":"Consigue que no deslicen en el primer segundo. Entra por el dato, la escena o la afirmación más concreta que tengas, sin preámbulo. Funciona si alguien que no conoce la marca entiende de qué va sin necesitar contexto."},{"nombre":"Lead","guia":"Sostiene hasta el segundo 10 explicando por qué esto le toca a quien está mirando. Nombra la situación concreta en la que aparece el problema. Funciona si el espectador se reconoce en ella."},{"nombre":"Body 1","guia":"Primera pieza de valor real: algo que el espectador no sabía o no había conectado. Un solo punto, sostenido por un detalle verificable."},{"nombre":"Puente","guia":"Enlaza con la idea siguiente dejando algo sin resolver. La curiosidad la crea la información que falta, no una frase de transición: no anuncies que viene lo mejor ni uses muletillas de enganche."},{"nombre":"Body 2","guia":"Segunda pieza de valor y remate: cierra lo que el puente dejó abierto y lleva la idea hasta su consecuencia práctica."},{"nombre":"CTA","guia":"Una sola acción, la que esta pieza concreta justifica. Si no la justifica, cierra con la pregunta que el espectador ya se está haciendo. Nunca varias acciones a la vez."}]',
  1
),
(
  now()::text,
  NULL,
  'Storytelling en 3 actos',
  'Historia personal o de cliente con arco completo. Ideal para el pilar de adoctrinamiento: casos y resultados.',
  '[{"nombre":"Contexto","guia":"Sitúa la escena en 1-2 frases: quién, cuándo y qué estaba en juego. Funciona si el espectador reconoce la situación como propia."},{"nombre":"Conflicto","guia":"Dónde se rompió. Aquí vive la tensión: concreta con cifras, plazos o decisiones reales, no con adjetivos."},{"nombre":"Punto de giro","guia":"La decisión o el hallazgo que cambió el rumbo. Es la pieza de valor contada como historia, no la moraleja adelantada."},{"nombre":"Resolución","guia":"El resultado concreto, solo hasta donde se pueda sostener. Sin exagerar y sin dar a entender que se repite siempre."},{"nombre":"Lección","guia":"Lo que se lleva quien no va a comprar nada. Una sola idea, formulada de modo que pueda aplicarla mañana."},{"nombre":"CTA","guia":"Una sola acción, coherente con la historia que acaba de contarse."}]',
  1
),
(
  now()::text,
  NULL,
  'Mito vs Realidad',
  'Desmonta una creencia extendida del nicho. Para el pilar de crecimiento: postura, criterio y discusión sana.',
  '[{"nombre":"El Mito","guia":"Enuncia la creencia tal cual circula, sin ironía. Funciona si quien la sostiene asiente al oírla."},{"nombre":"Por qué se cree","guia":"Valida qué la hace razonable: quién la promueve y qué parte de ella es cierta. Esto es lo que da autoridad para desmontarla."},{"nombre":"La Realidad","guia":"Qué ocurre de verdad, con el dato, el caso o la experiencia que lo sostiene. Sin algo verificable detrás, este bloque no existe."},{"nombre":"El coste","guia":"Qué pierde en concreto quien sigue actuando según el mito: dinero, plazo u opciones que se cierran."},{"nombre":"Qué hacer en su lugar","guia":"La alternativa aplicable, en uno o dos pasos. Específica para el caso planteado: si sirve para cualquiera, no sirve."},{"nombre":"CTA","guia":"Una sola acción, o la pregunta que abra conversación real sobre el mito."}]',
  1
),
(
  now()::text,
  NULL,
  'Vídeo largo (5-8 min)',
  'Versión larga de una idea que ya funcionó en corto (YouTube o vídeo de autoridad). Profundiza donde el reel solo apuntaba.',
  '[{"nombre":"Hook","guia":"Plantea en los primeros 15 segundos el problema y el resultado que se lleva quien se quede hasta el final. Funciona si dice para quién es este vídeo y para quién no."},{"nombre":"Contexto","guia":"Por qué este tema importa ahora y qué se suele hacer mal. Apóyate en una situación real o en una cifra concreta, no en generalidades."},{"nombre":"Bloque 1","guia":"Primera idea de fondo, desarrollada con un ejemplo paso a paso. Termina con lo que el espectador ya puede aplicar."},{"nombre":"Bloque 2","guia":"Segunda idea, más avanzada que la primera: el matiz o la excepción que distingue a quien domina el tema. Con caso propio o de cliente."},{"nombre":"Bloque 3","guia":"La pieza que une los dos bloques anteriores en un método o criterio de decisión. Es lo que justifica haber visto la versión larga."},{"nombre":"Errores comunes","guia":"Dos o tres errores frecuentes al aplicar lo anterior, cada uno con su consecuencia concreta y cómo evitarlo."},{"nombre":"Cierre y CTA","guia":"Resume el método en una frase aplicable y propone una sola acción coherente con el nivel de compromiso que ya generó el vídeo."}]',
  1
),
(
  now()::text,
  NULL,
  'Lista Top-N con giro',
  'Tres puntos donde el último cambia la lectura de los anteriores. Alta retención y muy compartible.',
  '[{"nombre":"Hook","guia":"Promete la lista y qué cambia al conocerla. El número que anuncies es exactamente el que entregas. Máximo tres elementos: acumular más suena a alarma, no a criterio."},{"nombre":"Punto 1","guia":"El más conocido: establece que dominas el terreno. Breve, sin detenerse."},{"nombre":"Punto 2","guia":"Menos obvio que el anterior, con un ejemplo concreto que lo haga tangible."},{"nombre":"Punto final (el giro)","guia":"El que cambia la lectura de los dos anteriores: apunta al problema de fondo, no a un truco más. Es el que hace que la compartan."},{"nombre":"CTA","guia":"Una sola acción. Si la lista ya dejó algo abierto, basta con esa pregunta."}]',
  1
)
ON CONFLICT (user_id, nombre) DO NOTHING;
