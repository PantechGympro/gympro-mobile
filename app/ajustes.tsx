/**
 * Ajustes — pantalla compartida por todos los roles (como notifications.tsx).
 *
 * Nace del rediseño de navegación global: antes de este cambio, la única
 * forma de llegar a Accesibilidad era un ícono en el header del cajón del
 * Miembro; ahora "Ajustes" es su propia entrada de menú (ver
 * components/navigation/CustomDrawer.tsx) y necesita una pantalla real
 * detrás, no solo un modal suelto. Por ahora agrupa Accesibilidad (ya
 * existía, reutilizada tal cual) y la información básica de versión; es el
 * lugar natural donde crecer más ajustes de cuenta/app a futuro sin volver
 * a tocar la navegación.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, useFontScale } from '../hooks/useColors';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import AccessibilityPanel from '../components/settings/AccessibilityPanel';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function Fila({
  icon, label, sublabel, onPress, colors, fs,
}: {
  icon: IconName; label: string; sublabel?: string; onPress: () => void;
  colors: ReturnType<typeof useColors>; fs: number;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.fila}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.filaIcono, { backgroundColor: colors.surface }]}>
        <Ionicons name={icon} size={20} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.filaLabel, { color: colors.text, fontSize: 15 * fs }]}>{label}</Text>
        {sublabel && (
          <Text style={[styles.filaSub, { color: colors.textSecondary, fontSize: 12 * fs }]}>{sublabel}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function AjustesScreen() {
  const colors = useColors();
  const fs = useFontScale();
  const [showA11y, setShowA11y] = useState(false);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Ajustes" showBack />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card padding={4}>
          <Fila
            icon="accessibility-outline"
            label="Accesibilidad"
            sublabel="Tema, tamaño de texto, contraste y movimiento"
            onPress={() => setShowA11y(true)}
            colors={colors}
            fs={fs}
          />
        </Card>

        <View style={styles.aboutBlock}>
          <Text style={[styles.aboutText, { color: colors.textMuted, fontSize: 12 * fs }]}>
            GymPro v1.0.0
          </Text>
        </View>
      </ScrollView>

      <AccessibilityPanel visible={showA11y} onClose={() => setShowA11y(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  content: { padding: 20, gap: 16 },
  fila: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 10,
  },
  filaIcono: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  filaLabel: { fontWeight: '600' },
  filaSub:   { marginTop: 2 },
  aboutBlock: { alignItems: 'center', marginTop: 8 },
  aboutText:  {},
});
