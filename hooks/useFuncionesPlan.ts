/**
 * useFuncionesPlan -- banderas de función del plan contratado por el gimnasio.
 *
 * Contrato: GET /api/auth/me -> { funciones_plan: { analiticas_ia: bool, pos: bool, ... } }.
 * Sirve para explicar el bloqueo ANTES de que la persona toque algo; el API
 * sigue siendo la fuente de verdad y responde 402 igual. `permite` devuelve
 * true mientras no se sabe (carga, sin red): ante la duda no se bloquea.
 */
import { ENDPOINTS } from '../constants/Api';
import { useFetch } from './useFetch';

export type FuncionPlan =
  | 'analiticas_ia' | 'rutinas_ia' | 'reportes_pdf' | 'app_movil' | 'pos'
  | 'cobros_en_linea' | 'respaldos' | 'soporte_prioritario' | 'ml_lab';

interface MeResponse { funciones_plan?: Partial<Record<FuncionPlan, boolean>> }

export function useFuncionesPlan() {
  const { data, loading } = useFetch<MeResponse>(ENDPOINTS.AUTH_ME, undefined, { cache: true });
  const funciones = data?.funciones_plan ?? {};
  return {
    funciones,
    loading,
    permite: (f: FuncionPlan) => funciones[f] !== false,
  };
}
