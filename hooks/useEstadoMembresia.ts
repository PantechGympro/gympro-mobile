/**
 * useEstadoMembresia -- estado de la membresía del miembro autenticado.
 *
 * Contrato: GET /api/user/membership/estado (siempre disponible, aun vencida).
 * La app lo usa para (1) bloquear módulos con una pantalla empática antes de
 * que el usuario toque algo y (2) mostrar el aviso de "por vencer". El API
 * igualmente rechaza con 403 `codigo: membresia_vencida`, así que esto es
 * experiencia, no seguridad.
 *
 * Con caché de lectura (HU-30): sin conexión se usa el último estado conocido.
 * Si la consulta falla del todo, `bloqueado` es false: ante la duda no se
 * encierra a alguien que sí pagó; el servidor decide en cada petición.
 */
import { ENDPOINTS } from '../constants/Api';
import { useFetch } from './useFetch';

export interface EstadoMembresia {
  vigente:          boolean;
  estado:           'activa' | 'por_vencer' | 'vencida' | 'sin_membresia';
  codigo:           null | 'membresia_vencida' | 'sin_membresia';
  nombre:           string | null;
  fecha_fin_local:  string | null;
  dias_restantes:   number | null;
  vencio_hace_dias: number | null;
  mensaje:          string | null;
  bloquea:          string[];
}

export function useEstadoMembresia() {
  const { data, loading, refetch } = useFetch<EstadoMembresia>(
    ENDPOINTS.MEMBERSHIP_ESTADO, undefined, { cache: true },
  );
  return {
    estado:    data,
    loading,
    refetch,
    bloqueado: !!data && data.vigente === false,
  };
}
