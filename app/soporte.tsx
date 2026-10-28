/**
 * Soporte — pantalla compartida por todos los roles (como notifications.tsx
 * y ajustes.tsx). Nace del rediseño de navegación global: "Soporte" pasa a
 * ser una entrada directa del cajón (antes no existía ningún punto de
 * contacto dentro de la app).
 *
 * Contenido deliberadamente simple: un canal de contacto por correo y un
 * par de preguntas frecuentes reales del dominio del gimnasio piloto. No
 * hay backend de tickets de soporte en GymPro todavía -- cuando exista, esta
 * pantalla es el lugar natural para enlazarlo sin tocar la navegación de
 * nuevo.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, useFontScale } from '../hooks/useColors';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';

const CORREO_SOPORTE = 'soporte@gympro.app';

const PREGUNTAS = [
  {
    q: '¿Cómo registro mi entrada al gimnasio?',
    a: 'Desde el tab Inicio, toca el ícono de código QR (arriba a la derecha) y escanéalo en recepción.',
  },
  {
    q: '¿Dónde veo mi membresía y mis pagos?',
    a: 'En el menú lateral, entra a "Membresía" -- ahí mismo puedes consultar tu historial de pagos.',
  },
  {
    q: '¿Cómo contacto a mi entrenador?',
    a: 'Desde el tab Entrenamiento, el chat con tu entrenador está siempre disponible.',
  },
];

export default function SoporteScreen() {
  const colors = useColors();
  const fs = useFontScale();

  const contactar = () => Linking.openURL(`mailto:${CORREO_SOPORTE}`);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Soporte" showBack />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card>
          <View style={styles.contactoRow}>
            <View style={[styles.contactoIcono, { backgroundColor: colors.accent + '22' }]}>
              <Ionicons name="mail-outline" size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.contactoTitulo, { color: colors.text, fontSize: 15 * fs }]}>
                ¿Necesitas ayuda?
              </Text>
              <Text style={[styles.contactoSub, { color: colors.textSecondary, fontSize: 13 * fs }]}>
                Escríbenos a {CORREO_SOPORTE}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={contactar}
            style={[styles.botonContacto, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Enviar correo a soporte"
          >
            <Text style={[styles.botonContactoTexto, { color: colors.onAccent, fontSize: 14 * fs }]}>
              Contactar por correo
            </Text>
          </TouchableOpacity>
        </Card>

        <Text style={[styles.seccionTitulo, { color: colors.text, fontSize: 14 * fs }]}>
          Preguntas frecuentes
        </Text>
        {PREGUNTAS.map(({ q, a }) => (
          <Card key={q} padding={14}>
            <Text style={[styles.pregunta, { color: colors.text, fontSize: 14 * fs }]}>{q}</Text>
            <Text style={[styles.respuesta, { color: colors.textSecondary, fontSize: 13 * fs }]}>{a}</Text>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  content: { padding: 20, gap: 14, paddingBottom: 32 },
  contactoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  contactoIcono: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  contactoTitulo: { fontWeight: '700' },
  contactoSub:    { marginTop: 2 },
  botonContacto: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  botonContactoTexto: { fontWeight: '700' },
  seccionTitulo: { fontWeight: '700', marginTop: 4 },
  pregunta:  { fontWeight: '600', marginBottom: 4 },
  respuesta: { lineHeight: 19 },
});
