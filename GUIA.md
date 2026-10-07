# Brandpanel — Guía (beta cerrada)

El centro de mando para **gestores de contenido que trabajan con varios
clientes en Instagram** (con guiones y notas de edición listos para
entregarle a su editor de video): mide las publicaciones de cada
cliente, las califica, propone ideas y genera guiones de video (con notas de
edición) y carruseles que el cliente final aprueba con un enlace, sin cuenta.

**Producción:** https://cmpanel-liart.vercel.app
**Local:** `cd brandpanel && npm run dev` (http://localhost:3000)

---

## Modelo mental

- **Tú (editor/agencia)** tienes una cuenta con la que gestionas **N clientes**.
- **Cada cliente** tiene su propio Instagram conectado, su ficha de marca
  (🧠 Marca), sus métricas, ideas, propuestas, campañas y calendario —
  totalmente separados del resto.
- **Tu librería de Estructuras** de guion y tu cupo diario de IA son tuyos,
  compartidos entre todos tus clientes.
- El **cliente activo** se cambia desde el selector de la barra lateral o en
  la página «Clientes». Todo lo que ves y generas pertenece al cliente activo.

## Alta de un beta tester (lo haces tú, dueño de la plataforma)

1. Comparte la URL + el **código de invitación** (`BETA_INVITE_CODE` en las
   env de Vercel). Sin código no hay registro.
2. Para que pueda conectar el Instagram de un cliente por OAuth mientras la
   app de Meta está en modo desarrollo: añade esa cuenta de IG como **tester**
   en developers.facebook.com → tu app → Roles. (Plan B sin invitación: pegar
   un token manual en Ajustes → Avanzado.)
3. Vigila su consumo de IA los primeros días en `/admin` (default:
   40 ops/día por editor, ajustable por usuario o con `AI_DAILY_LIMIT`).

## Flujo de trabajo del editor

1. **Onboarding**: crea su primer cliente → conecta el IG del cliente →
   rellena la ficha de marca → primer sync.
2. **Dashboard → Sincronizar**: trae posts, historias y comentarios del
   cliente activo (además hay un cron diario automático para todos).
3. **Dashboard → Analizar con IA**: nota 1-10 por post frente a la media de
   ESA cuenta, ganadores ⭐ y diagnóstico con acciones.
4. **Ideas y nicho**: investiga el nicho del cliente (o sus comentarios
   reales) y propone ideas por pilar de contenido.
5. **Crear contenido**: desde una idea o un post ganador → **guion de video**
   (elige estructura; cada sección trae el texto hablado + 🎬 notas de
   edición: plano, B-roll, texto en pantalla, duración) o **carrusel** con la
   identidad visual del cliente.
6. **Propuestas → 🔗 Compartir con cliente**: genera un enlace público; el
   cliente final lo abre sin cuenta y **aprueba** o **pide cambios**. El
   feedback aparece en la tarjeta y se puede aplicar con un clic
   («Regenerar aplicando su feedback»).
7. **Aprobada → Descargar**: `.txt` del guion (con notas de edición) o `.zip`
   del carrusel (PNGs 1080×1350 + caption) → editar/grabar → publicar a mano.
8. **Calendario / Pipeline / Campañas**: planifica y sigue la producción de
   cada cliente; **Métricas** e informes ejecutivos para reportarle.

## Sistema de contenido semanal

1. **Referentes** (Analiza): añade 3-5 cuentas de referencia y pega sus
   mejores piezas (transcripción o caption + vistas). Con 3 o más piezas con
   vistas se marca cuánto superó cada una la media de su cuenta (×N).
   «Analizar con IA» extrae gancho, estructura y patrón; se pueden guardar
   como gancho o como estructura. En **Ideas** → «👁 Desde tus referentes»
   la IA adapta esos patrones a la marca (nunca copia el tema).
2. **Guion**: igual que antes. Al aprobarse, el guion entra al Pipeline en
   «Por grabar» y el carrusel en «En edición».
3. **Grabación** (Planifica): agrupa los guiones en una sesión (un día a la
   semana) y grábalos con el **teleprompter** (espacio pausa, ↑↓ velocidad,
   ←→ pieza, modo espejo). Marcar «grabado» mueve la pieza y su gemela.
4. **Pipeline**: fases idea → por grabar → grabado → en edición → revisión →
   listo → publicado (los carruseles se saltan la grabación). En cada pieza:
   versión corta/larga, fecha de entrega de edición, indicaciones para el
   editor, enlace de la entrega y **«Copiar brief para el editor»** (para
   mandarlo por WhatsApp/email). «Duplicar en versión larga/corta» crea la
   pieza gemela: dos formatos por cada grabación.
5. **Testeo y exprimir**: marca una pieza como 🧪 prueba y enlázala a su post
   publicado. Cada post muestra su ×N frente a la mediana de la cuenta; si
   una prueba supera ×1,5 salta una alerta en Métricas. **🍋 Exprimir** (en
   Publicaciones y Dashboard, solo ganadores) genera de una vez reel corto +
   carrusel + vídeo largo (3 operaciones de IA).

## Cómo se califica cada post

Engagement ponderado = (likes + comentarios + 2×guardados + 3×compartidos) / alcance.
La nota 1-10 es el percentil frente al histórico de esa misma cuenta. Un post
es **ganador** si su engagement supera 1,5× la mediana con alcance sobre la
mediana.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Transaction Pooler de Supabase (6543) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Auth |
| `NEXT_PUBLIC_APP_URL` | URL pública (OAuth IG + enlaces) |
| `SESSION_SECRET` | HMAC del state OAuth |
| `LLM_PROVIDER` / `LLM_API_KEY` (+`LLM_MODEL`/`LLM_BASE_URL`) | IA del servidor |
| `TAVILY_API_KEY` | Búsqueda web para Ideas (opcional) |
| `CRON_SECRET` | Bearer del cron diario |
| `BETA_INVITE_CODE` | Código de registro de la beta (sin definir = registro abierto) |
| `AI_DAILY_LIMIT` | Override del cupo de IA por editor (default 40) |
| `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` | OAuth de IG (opcional; hay token manual) |

## Migración a multi-cliente (una sola vez, producción)

La base desplegada antes de julio-2026 usaba tenancy por usuario. Para migrarla:

```bash
# 1. Backup primero (Ajustes → Descargar copia de seguridad)
DATABASE_URL="postgres://…pooler…:6543/postgres" node scripts/migrate-clients.mjs
```

Crea 1 cliente por usuario existente, reasigna todo su contenido y elimina la
columna `user_id` de las tablas de contenido. Idempotente. Instalaciones
nuevas: ejecutar `scripts/schema.sql` directamente.

## Galería de estructuras y formatos

**Estructuras** (`/estructuras`) tiene dos pestañas con filtro por pilar:

- **Estructuras de guion** (18 base: 7 de crecimiento, 7 de adoctrinamiento y 4 de
  conversión). Cada ficha incluye la señal de Instagram que empuja, la duración,
  cuándo usarla y **cuándo no**, por qué funciona, cómo grabarla, los ganchos que
  le encajan, referentes y fuentes. Fuente de verdad: `lib/baseStructures.ts`.
- **Formatos de grabación** (24): cómo se filma la pieza (pizarra, nota del
  móvil, pantalla verde, videollamada…). Salen de los formatos validados de VK
  Metrics, filtrados. Al crear un guion se elige estructura (agrupada por pilar)
  y formato de grabación, y las notas de edición se adaptan al formato.
  Fuente: `lib/executionFormats.ts`.

## Migración del sistema de contenido (una sola vez, producción)

Añade las fases de producción, sesiones de grabación, referentes, `perf_ratio`
y la galería de estructuras (columnas `pilar`/`ficha` y las 18 estructuras base). Aditiva e idempotente; ejecutar ANTES de
desplegar el código que la usa:

```bash
DATABASE_URL="postgres://…pooler…:6543/postgres" npx tsx scripts/migrate-production-system.mjs
```

Después, pulsa «Analizar con IA» o sincroniza para que se calcule el ×N
(`perf_ratio`) de los posts existentes.
