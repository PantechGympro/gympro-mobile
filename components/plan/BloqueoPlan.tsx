/**
 * BloqueoPlan -- explica con calma cuando una función no está en el plan del gimnasio.
 *
 *   export default conFuncionDePlan(MiPantalla, 'pos', 'el Punto de Venta');
 *
 * Mismo criterio que el API (@require_funcion_plan -> 402): aquí solo se evita
 * dejar a la persona frente a una pantalla que va a fallar. Según el rol cambia
 * el siguiente paso: el propietario puede ver planes; el resto, hablar con él.
 */
import React from 'react';
import { Alert, View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors, useFontScale } from '../../hooks/useColors';
import { useAuth } from '../../hooks/useAuth';
import { useFuncionesPlan, FuncionPlan } from '../../hooks/useFuncionesPlan';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';

/** Texto para el rol actual. `role` viene de useAuth: 'owner_gym' | 'Admin' | 'trainer' | 'user' | ... */
export function mensajePlan(nombre: string, role?: string) {
  const base = `${nombre} no está incluido en el plan actual de tu gimnasio.`;
  if (role === 'owner_gym') return `${base} Puedes mejorar tu plan cuando quieras.`;
  if (role === 'user') return `${base} Por ahora no está activo para tus entrenamientos; pregunta en recepción si habrá novedades.`;
  return `${base} Pídele al propietario que revise las opciones de plan.`;
}

/** Aviso corto (por ejemplo, al tocar un botón de PDF cuando el plan no lo incluye). */
export function avisarPlanNoIncluido(nombre: string, role?: string) {
  Alert.alert('Disponible en un plan superior', mensajePlan(nombre, role));
}

function PantallaPlan({ nombre }: { nombre: string }) {
  const colors = useColors();
  const fs = useFontScale();
  const router = useRouter();
  const { user } = useAuth();
  const esPropietario = user?.role === 'owner_gym';

  return (
    <ScrollView contentContainerStyle={styles.wrap} style={{ backgroundColor: colors.background }}>
      <View style={[styles.icono, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="lock-closed-outline" size={38} color={colors.warning} />
      </View>
      <Text accessibilityRole="header" style={[styles.titulo, { color: colors.text, fontSize: 22 * fs }]}>
        Disponible en un plan superior
      </Text>
      <Text style={[styles.texto, { color: colors.textSecondary, fontSize: 15 * fs }]}>
        {mensajePlan(nombre, user?.role)}
      </Text>
      <Text style={[styles.texto, { color: colors.textSecondary, fontSize: 14 * fs }]}>
        El resto de tu app sigue funcionando con normalidad.
      </Text>
      {esPropietario ? (
        <View style={styles.acciones}>
          <Button label="Ver planes" onPress={() => router.push('/(admin)/suscripcion')}
                  accessibilityLabel="Ver los planes disponibles" />
        </View>
      ) : null}
    </ScrollView>
  );
}

export function conFuncionDePlan<P extends object>(
  Pantalla: React.ComponentType<P>,
  funcion: FuncionPlan,
  nombre: string,
): React.ComponentType<P> {
  function ConPlan(props: P) {
    const { loading, funciones, permite } = useFuncionesPlan();
    if (loading && !Object.keys(funciones).length) return <LoadingSpinner />;
    if (!permite(funcion)) return <PantallaPlan nombre={nombre} />;
    return <Pantalla {...props} />;
  }
  ConPlan.displayName = `conFuncionDePlan(${Pantalla.displayName || Pantalla.name || 'Pantalla'})`;
  return ConPlan;
}

const styles = StyleSheet.create({
  wrap:     { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  icono:    { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 4 },
  titulo:   { fontWeight: '700', textAlign: 'center' },
  texto:    { textAlign: 'center', lineHeight: 22, maxWidth: 340 },
  acciones: { alignSelf: 'stretch', gap: 10, marginTop: 18, maxWidth: 420, width: '100%' },
});
