# Panel de Marca — Guía de puesta en marcha

Tu CM con IA para Instagram: mide tus publicaciones, las califica, te recomienda,
investiga tu nicho y te propone carruseles que tú apruebas y publicas a mano.

## Arrancar la plataforma

```bash
cd brandpanel
npm run build && npm run start   # producción, en http://localhost:3000
# o durante desarrollo: npm run dev
```

**Contraseña de acceso:** `adshouse2026` (cámbiala en `.env.local`, variable `APP_PASSWORD`).

---

## Paso 1 — Conectar tu Instagram (10 min, gratis)

Requisito: tu cuenta de Instagram debe ser **profesional** (Creador o Empresa).
Se cambia gratis en la app: Configuración → Tipo de cuenta y herramientas.

1. Entra en [developers.facebook.com](https://developers.facebook.com) con tu Facebook y crea una cuenta de desarrollador si no la tienes.
2. **Mis apps → Crear app** → caso de uso: *"Administrar todo en tu cuenta de Instagram"* (o añade el producto **Instagram** a una app en blanco).
3. En el panel de la app: **Instagram → Configuración de la API con inicio de sesión de Instagram**.
4. En la sección **Generar tokens de acceso**: añade tu cuenta de Instagram y pulsa **Generar token**. Inicia sesión con tu Instagram y copia el token (empieza por `IGAA...`). Es un token de larga duración (60 días).
5. Pega el token en **Ajustes → Conexión con Instagram** y pulsa **Probar conexión**. Debe aparecer tu @usuario y tus seguidores.

> La app puede quedarse en "modo desarrollo" para siempre: como solo la usas tú
> con tu propia cuenta, **no necesitas pasar la revisión de Meta**.

**Renovación:** el token caduca a los 60 días. Pulsa **Renovar token** en Ajustes
una vez al mes y queda renovado otros 60 días.

## Paso 2 — Conectar la IA gratuita (5 min)

Opción recomendada: **Groq** (gratis, rápido).

1. Entra en [console.groq.com](https://console.groq.com) → crea cuenta → **API Keys** → crea una clave (`gsk_...`).
2. Pégala en **Ajustes → Proveedor de IA** con proveedor "Groq" y pulsa **Probar IA**.

Alternativas igual de válidas (mismo campo, cambia el proveedor en el desplegable):
- **OpenRouter** ([openrouter.ai/keys](https://openrouter.ai/keys)) — usa modelos con sufijo `:free`.
- **Google Gemini** ([aistudio.google.com](https://aistudio.google.com)) — capa gratuita amplia.

## Paso 3 (opcional) — Búsqueda web para investigar tu nicho

1. Crea cuenta gratis en [tavily.com](https://tavily.com) (1.000 búsquedas/mes gratis).
2. Pega la clave en **Ajustes → Búsqueda web**.

Sin esto, la sección "Ideas y nicho" funciona igual pero sin datos web en vivo.

## Paso 4 — Tu cerebro de marca

En **🧠 Marca** rellena identidad (nombre, @handle, color, nicho), cliente
ideal, propuesta de valor, misión, tono de voz, líneas de contenido,
objetivos y qué evitar. Esta ficha se inyecta automáticamente en cada
análisis, idea de contenido y propuesta de carrusel que genere la IA — cuanto
más completa esté, mejor te va a entender. El color y el handle además salen
impresos en los carruseles.

---

## Cómo se usa en el día a día

1. **Dashboard → Sincronizar Instagram**: trae tus últimos 100 posts con alcance, guardados, compartidos, etc. Hazlo 1 vez al día o cuando publiques.
2. **Dashboard → Analizar con IA**: tu CM califica todo (nota 1-10 frente a tu propia media), detecta **ganadores ⭐** y escribe el diagnóstico con acciones.
3. **Ideas y nicho → Investigar ahora**: busca temas calientes de tu nicho y propone 6 ideas.
4. En **Publicaciones** o en **Ideas**, pulsa **Recrear 🎨 / Crear carrusel**: la IA diseña un carrusel nuevo (slides + caption + hashtags).
5. En **Propuestas**: revisa el diseño → **Aprobar** → **Descargar ZIP** (PNGs 1080×1350 + caption.txt) → publícalo tú en Instagram.

## Cómo se califica cada post

Engagement ponderado = (likes + comentarios + 2×guardados + 3×compartidos) / alcance.
La nota 1-10 es tu percentil frente a tu propio histórico. Un post es **ganador**
si su engagement supera 1,5× tu mediana con alcance por encima de la mediana.

## Datos de demostración

En **Ajustes → Datos de demostración** puedes cargar 12 posts ficticios para ver
la plataforma funcionando antes de conectar nada, y borrarlos después.

---

## Preguntas pendientes para ti

1. **¿Tu cuenta de Instagram ya es profesional (Creador/Empresa)?** Es requisito de Meta para leer métricas.
2. **¿Nicho y marca?** Rellena "Marca y nicho" en Ajustes — de eso depende la calidad de las ideas y carruseles.
3. **¿La quieres online?** Ahora corre en tu Mac (localhost). Si la quieres accesible desde cualquier sitio con tu login, se puede desplegar (requiere mover SQLite a una BD cloud tipo Turso/Supabase — lo hago cuando me digas).
