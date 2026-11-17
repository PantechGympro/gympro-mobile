/**
 * Mensajes de error amigables (UX copywriting) — equivalente móvil de
 * gympro-web/src/utils/errores.js.
 *
 * Regla: la UI nunca muestra `err.message` crudo ("Network Error",
 * "Request failed with status code 500", "timeout of 15000ms exceeded").
 * El API ya devuelve textos en español para 4xx; los 5xx llegan saneados
 * (con un folio `ref` para soporte). Todo lo demás se traduce aquí.
 */

/** Mensaje por código HTTP cuando el servidor no dio uno propio. */
export function mensajePorEstado(status?: number): string {
  if (!status) return 'No pudimos conectar con GymPro. Revisa tu conexión a internet e inténtalo de nuevo.';
  if (status === 401) return 'Tu sesión terminó. Vuelve a iniciar sesión para continuar.';
  if (status === 403) return 'Tu cuenta no tiene permiso para hacer esto. Si crees que es un error, avisa al gimnasio.';
  if (status === 404) return 'No encontramos lo que buscabas. Puede que ya no exista.';
  if (status === 408 || status === 504) return 'La respuesta tardó demasiado. Inténtalo de nuevo en unos segundos.';
  if (status === 413) return 'El archivo es demasiado grande. Prueba con uno más ligero.';
  if (status === 429) return 'Hiciste varios intentos seguidos. Espera un momento y vuelve a probar.';
  if (status >= 500) return 'Algo salió mal de nuestro lado. Ya estamos en ello; inténtalo de nuevo en unos minutos.';
  return 'No pudimos completar la acción. Revisa los datos e inténtalo de nuevo.';
}

/** Convierte cualquier error (axios o JS) en un texto apto para el usuario. */
export function mensajeAmigable(err: any, porDefecto?: string): string {
  const status: number | undefined = err?.response?.status;
  const delServidor = err?.response?.data?.error ?? err?.response?.data?.msg;
  if (typeof delServidor === 'string' && delServidor.trim()) {
    // Los 5xx saneados traen folio: lo mostramos para que soporte pueda ubicar el caso.
    const ref = err?.response?.data?.ref;
    return ref && status && status >= 500 ? `${delServidor} (folio ${ref})` : delServidor;
  }
  if (err?.code === 'ECONNABORTED') return mensajePorEstado(408);
  if (!status) return mensajePorEstado(undefined);
  return porDefecto && status < 500 ? porDefecto : mensajePorEstado(status);
}
