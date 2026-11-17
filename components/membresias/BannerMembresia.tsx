/**
 * BannerMembresia -- aviso en el inicio del miembro: por vencer (<= 7 días),
 * vencida o sin membresía. Silencioso cuando todo está en orden.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors, useFontScale } from '../../hooks/useColors';
import { useEstadoMembresia } from '../../hooks/useEstadoMembresia';

export default function BannerMembresia() {
  const colors = useColors();
  const fs = useFontScale();
  const router = useRouter();
  const { estado } = useEstadoMembresia();
  if (!estado || estado.estado === 'activa') return null;

  const d = estado.dias_restantes ?? 0;
  let texto: string;
  let accion = 'Renovar';
  let icono: React.ComponentProps<typeof Ionicons>['name'] = 'alert-circle';
  let tono = colors.warning;

  if (estado.estado === 'por_vencer') {
    texto = d <= 0 ? 'Tu membresía vence hoy. Renueva para no perder el acceso.'
      : d === 1 ? 'Tu membresía vence mañana. Renueva para no perder el acceso.'
      : `Tu membresía vence en ${d} días. Renueva a tiempo y sigue entrenando.`;
  } else if (estado.estado === 'vencida') {
    texto = `Tu membresía venció el ${estado.fecha_fin_local}. Renuévala para volver a entrenar; tu progreso sigue guardado.`;
    icono = 'time';
    tono = colors.error;
  } else {
    texto = 'Aún no tienes una membresía activa. Elige un plan para empezar.';
    accion = 'Elegir plan';
    icono = 'ticket';
  }

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${texto} ${accion}`}
      onPress={() => router.push('/(member)/membership')}
      style={[styles.caja, { backgroundColor: colors.card, borderColor: tono }]}
      activeOpacity={0.8}
    >
      <Ionicons name={icono} size={22} color={tono} />
      <Text style={[styles.texto, { color: colors.text, fontSize: 14 * fs }]}>{texto}</Text>
      <Text style={[styles.accion, { color: colors.accent, fontSize: 14 * fs }]}>{accion}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  caja:   { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 12, minHeight: 56 },
  texto:  { flex: 1, lineHeight: 20 },
  accion: { fontWeight: '700' },
});
