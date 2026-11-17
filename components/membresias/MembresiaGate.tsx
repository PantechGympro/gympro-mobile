/**
 * MembresiaGate -- bloqueo amable de módulos cuando la membresía no está vigente.
 *
 *   export default conMembresiaVigente(MiPantalla, 'tus rutinas');
 *
 * Qué se bloquea (lo decide el API, ver utils/membresia.py): check-in, rutinas
 * y registro de entrenos, nutrición y chat con el entrenador. Membresía y pagos,
 * perfil, salud/progreso, logros, notificaciones y soporte siguen abiertos: son
 * el camino para renovar y los datos del propio miembro.
 *
 * Tono: sin culpa ni reproche; explica qué pasó, qué se conserva y qué hacer.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors, useFontScale } from '../../hooks/useColors';
import { useEstadoMembresia } from '../../hooks/useEstadoMembresia';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';

function PantallaBloqueo({ servicio }: { servicio: string }) {
  const colors = useColors();
  const fs = useFontScale();
  const router = useRouter();
  const { estado } = useEstadoMembresia();
  const sinMembresia = estado?.codigo === 'sin_membresia';

  const titulo = sinMembresia ? 'Aún no tienes membresía' : 'Tu membresía venció';
  const detalle = sinMembresia
    ? `Elige un plan para empezar a usar ${servicio}.`
    : `Renueva tu membresía para volver a usar ${servicio}.`;

  return (
    <ScrollView
      contentContainerStyle={styles.wrap}
      style={{ backgroundColor: colors.background }}
    >
      <View style={[styles.icono, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name={sinMembresia ? 'ticket-outline' : 'time-outline'} size={40} color={colors.warning} />
      </View>
      <Text accessibilityRole="header" style={[styles.titulo, { color: colors.text, fontSize: 22 * fs }]}>{titulo}</Text>
      <Text style={[styles.texto, { color: colors.textSecondary, fontSize: 15 * fs }]}>{detalle}</Text>
      {!sinMembresia && estado?.fecha_fin_local ? (
        <Text style={[styles.dato, { color: colors.textMuted, fontSize: 13 * fs }]}>
          Venció el {estado.fecha_fin_local}
          {estado.nombre ? ` · ${estado.nombre}` : ''}
        </Text>
      ) : null}
      <Text style={[styles.tranquilo, { color: colors.textSecondary, fontSize: 14 * fs }]}>
        Tranquilo: tu progreso, tus medidas y tu historial siguen guardados.
      </Text>

      <View style={styles.acciones}>
        <Button
          label={sinMembresia ? 'Elegir mi membresía' : 'Renovar mi membresía'}
          onPress={() => router.push('/(member)/membership')}
          accessibilityLabel="Ir a Membresía y pagos"
        />
        <Button
          label="Volver al inicio"
          variant="secondary"
          onPress={() => router.replace('/(member)/(tabs)')}
        />
      </View>
    </ScrollView>
  );
}

/** Envuelve una pantalla: si la membresía no está vigente muestra la pantalla de bloqueo. */
export function conMembresiaVigente<P extends object>(
  Pantalla: React.ComponentType<P>,
  servicio: string,
): React.ComponentType<P> {
  function ConGuarda(props: P) {
    const { loading, bloqueado, estado } = useEstadoMembresia();
    if (loading && !estado) return <LoadingSpinner />;
    if (bloqueado) return <PantallaBloqueo servicio={servicio} />;
    return <Pantalla {...props} />;
  }
  ConGuarda.displayName = `conMembresiaVigente(${Pantalla.displayName || Pantalla.name || 'Pantalla'})`;
  return ConGuarda;
}

const styles = StyleSheet.create({
  wrap:      { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  icono:     { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 4 },
  titulo:    { fontWeight: '700', textAlign: 'center' },
  texto:     { textAlign: 'center', lineHeight: 22, maxWidth: 340 },
  dato:      { textAlign: 'center' },
  tranquilo: { textAlign: 'center', lineHeight: 20, maxWidth: 340, marginTop: 4 },
  acciones:  { alignSelf: 'stretch', gap: 10, marginTop: 18, maxWidth: 420, width: '100%' },
});
