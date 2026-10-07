// Caché en memoria por instancia del servidor.
//
// Motivo concreto: la página de marca previsualiza 10 composiciones de portada y
// cada render releía las mismas fotos de Postgres — unas 20 lecturas de hasta
// 2,4 MB para pintar la misma cara. Eso consumió el egress del plan.
//
// No es una caché distribuida: cada instancia tiene la suya y se pierde al
// reciclarse. Es exactamente lo que hace falta aquí, porque el problema es la
// ráfaga de lecturas idénticas dentro de una misma visita.

export type Cache<T> = {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  /** Invalida todo lo de un cliente tras subir, cambiar o borrar una foto. */
  invalidatePrefix(prefix: string): void;
  stats(): { hits: number; misses: number; size: number };
};

export function createCache<T>({
  ttlMs,
  max,
  now = () => Date.now(),
}: {
  ttlMs: number;
  max: number;
  /** Inyectable para poder probar la caducidad sin esperar. */
  now?: () => number;
}): Cache<T> {
  const entries = new Map<string, { at: number; value: T }>();
  let hits = 0;
  let misses = 0;

  return {
    get(key) {
      const hit = entries.get(key);
      if (!hit) {
        misses++;
        return undefined;
      }
      if (now() - hit.at >= ttlMs) {
        entries.delete(key);
        misses++;
        return undefined;
      }
      // Renueva la posición: el Map conserva el orden de inserción y así lo
      // último usado queda al final, que es lo que sobrevive al desalojo.
      entries.delete(key);
      entries.set(key, hit);
      hits++;
      return hit.value;
    },
    set(key, value) {
      entries.delete(key);
      entries.set(key, { at: now(), value });
      while (entries.size > max) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
    invalidatePrefix(prefix) {
      for (const key of [...entries.keys()]) if (key.startsWith(prefix)) entries.delete(key);
    },
    stats: () => ({ hits, misses, size: entries.size }),
  };
}
