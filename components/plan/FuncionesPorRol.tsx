/**
 * FuncionesPorRol -- "Ver todo lo que incluye" de un plan, rol por rol.
 * Lee `plan.funciones_por_rol` del API (constants/catalogo_funciones.py), la
 * misma lista que usa la web: lo bloqueado aquí es lo que el servidor rechaza.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, useFontScale } from '../../hooks/useColors';

export interface FuncionPlanItem { nombre: string; descripcion: string; bandera: string | null; incluido: boolean }
export type FuncionesPorRolMap = Record<string, FuncionPlanItem[]>;
interface PlanConDetalle { id: number; orden?: number; precio_mensual_mxn?: number; funciones_por_rol?: FuncionesPorRolMap }

/** Plan más barato que sí incluye la función, para decir "disponible desde X". */
function planDesde(planes: (PlanConDetalle & { nombre?: string })[], rol: string, nombre: string, actualId: number) {
  const orden = [...planes].filter((p) => p.id !== actualId)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || (a.precio_mensual_mxn ?? 0) - (b.precio_mensual_mxn ?? 0));
  return orden.find((p) => p.funciones_por_rol?.[rol]?.some((f) => f.nombre === nombre && f.incluido))?.nombre ?? null;
}

export default function FuncionesPorRol({ plan, planes }: { plan: PlanConDetalle; planes: PlanConDetalle[] }) {
  const colors = useColors();
  const fs = useFontScale();
  const roles = useMemo(() => Object.keys(plan.funciones_por_rol ?? {}), [plan]);
  const [abierto, setAbierto] = useState(false);
  const [rol, setRol] = useState<string | null>(null);
  if (!roles.length) return null;

  const actual = rol && roles.includes(rol) ? rol : roles[0];
  const items = plan.funciones_por_rol![actual];
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

  return (
    <View style={{ marginTop: 6 }}>
      <TouchableOpacity onPress={() => setAbierto((v) => !v)} accessibilityRole="button"
                        accessibilityState={{ expanded: abierto }}
                        accessibilityLabel={abierto ? 'Ver menos funciones' : 'Ver todo lo que incluye este plan'}
                        style={styles.toggle}>
        <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 * fs }}>
          {abierto ? 'Ver menos' : 'Ver todo lo que incluye'}
        </Text>
        <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
      </TouchableOpacity>

      {abierto ? (
        <View style={{ gap: 8, marginTop: 6 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 * fs, lineHeight: 17 * fs }}>
            Cada persona del equipo y cada socio usa su propia parte de GymPro. Esto incluye el plan para cada uno.
          </Text>
          <View style={styles.chips}>
            {roles.map((r) => {
              const on = r === actual;
              const n = plan.funciones_por_rol![r].filter((f) => f.incluido).length;
              return (
                <TouchableOpacity key={r} onPress={() => setRol(r)} accessibilityRole="tab"
                                  accessibilityState={{ selected: on }}
                                  style={[styles.chip, { borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accent : 'transparent' }]}>
                  <Text style={{ fontSize: 11.5 * fs, fontWeight: '700', color: on ? colors.onAccent : colors.textSecondary }}>
                    {r} · {n}/{plan.funciones_por_rol![r].length}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {items.map((f) => {
            const desde = !f.incluido ? planDesde(planes as any, actual, f.nombre, plan.id) : null;
            return (
              <View key={f.nombre} style={[styles.fila, { opacity: f.incluido ? 1 : 0.72 }]}>
                <Ionicons name={f.incluido ? 'checkmark-circle' : 'lock-closed-outline'} size={15}
                          color={f.incluido ? colors.dataProgreso : colors.textMuted} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 13 * fs, fontWeight: '700' }}>{f.nombre}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 * fs }}>{f.descripcion}</Text>
                  {!f.incluido ? (
                    <Text style={{ color: colors.warning, fontSize: 11.5 * fs, fontWeight: '700' }}>
                      {desde ? `Disponible desde el plan ${cap(desde)}` : 'No incluido en este plan'}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, minHeight: 44 },
  chips:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:   { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  fila:   { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
});
