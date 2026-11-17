/**
 * Membresías por vencer — pantalla compartida por Propietario/Administrador y
 * Recepción. Contrato: GET /api/membresias/por-vencer?dias=&incluir_vencidas=
 * → { miembros: [{ id, nombre, tipo_membresia, fecha_fin_local, dias_restantes,
 *                  horas_restantes, estado, telefono, email, foto_perfil }] }
 * El backend filtra por gimnasio y rol; aquí solo se presenta y se contacta.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Linking, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, useFontScale } from '../../hooks/useColors';
import { ENDPOINTS } from '../../constants/Api';
import { useFetch } from '../../hooks/useFetch';
import { toArray } from '../../utils/format';
import LoadingSpinner from '../ui/LoadingSpinner';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import AvatarFoto from '../ui/AvatarFoto';

interface Fila {
  id: string; nombre: string; tipo_membresia: string; fecha_fin_local: string;
  dias_restantes: number; horas_restantes: number; estado: 'activa' | 'por_vencer' | 'vencida';
  telefono?: string; email?: string; foto_perfil?: string | null;
}

const OPCIONES = [7, 15, 30];

/** "Vence hoy", "Vence mañana", "Vence en 5 días", "Venció hace 2 días". */
function textoRestante(f: Fila): string {
  const d = f.dias_restantes;
  if (f.estado === 'vencida') return d >= -1 ? 'Venció hoy' : `Venció hace ${Math.abs(d)} días`;
  if (d <= 0) return `Vence hoy (en ${Math.max(f.horas_restantes, 0)} h)`;
  return d === 1 ? 'Vence mañana' : `Vence en ${d} días`;
}

/** 10 dígitos se asumen de México (+52) para abrir WhatsApp. */
const whatsapp = (tel: string) => {
  const d = tel.replace(/\D/g, '');
  return `https://wa.me/${d.length === 10 ? `52${d}` : d}`;
};

export default function PorVencerScreen() {
  const colors = useColors();
  const fs = useFontScale();
  const styles = useMemo(() => make_styles(colors, fs), [colors, fs]);
  const insets = useSafeAreaInsets();
  const [dias, setDias] = useState(7);
  const [vencidas, setVencidas] = useState(false);

  const { data, loading, error, refetch } = useFetch<{ miembros: Fila[] }>(
    `${ENDPOINTS.MEMBRESIAS_POR_VENCER}?dias=${dias}&incluir_vencidas=${vencidas}`,
  );
  const filas = toArray<Fila>(data?.miembros);

  const contacto = (icon: keyof typeof Ionicons.glyphMap, etiqueta: string, url: string) => (
    <TouchableOpacity key={etiqueta} style={styles.contacto} onPress={() => Linking.openURL(url)}
      accessibilityRole="button" accessibilityLabel={etiqueta}>
      <Ionicons name={icon} size={18} color={colors.accent} />
      <Text style={styles.contactoTxt}>{etiqueta.split(' ')[0]}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title} accessibilityRole="header">Membresías por vencer</Text>
        <Text style={styles.sub}>Contacta a tiempo a quienes están por terminar su plan.</Text>
        <View style={styles.chips}>
          {OPCIONES.map((n) => (
            <TouchableOpacity key={n} onPress={() => setDias(n)} accessibilityRole="button"
              accessibilityState={{ selected: dias === n }}
              style={[styles.chip, dias === n && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
              <Text style={[styles.chipTxt, dias === n && { color: colors.onAccent }]}>{n} días</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.sub}>Incluir las que ya vencieron</Text>
          <Switch value={vencidas} onValueChange={setVencidas} accessibilityLabel="Incluir membresías ya vencidas" />
        </View>
      </View>

      {loading && filas.length === 0 ? (
        <LoadingSpinner fullScreen message="Buscando membresías…" />
      ) : (
        <FlatList
          data={filas}
          keyExtractor={(f) => f.id}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.accent} />}
          ListHeaderComponent={error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={44} color={colors.textMuted} />
              <Text style={styles.emptyTxt}>Ninguna membresía vence en los próximos {dias} días. ¡Buen trabajo!</Text>
            </View>
          }
          renderItem={({ item: f }) => (
            <Card style={{ marginBottom: 10 }}>
              <View style={styles.row}>
                <AvatarFoto foto={f.foto_perfil} nombre={f.nombre} size={44} borderRadius={14} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{f.nombre}</Text>
                  <Text style={styles.plan}>{f.tipo_membresia}</Text>
                </View>
                <Badge label={f.estado === 'vencida' ? 'Vencida' : 'Por vencer'} color={f.estado === 'vencida' ? 'error' : 'warning'} />
              </View>
              <Text style={styles.cuando}>{textoRestante(f)} · {f.fecha_fin_local}</Text>
              <View style={styles.contactos}>
                {f.telefono ? contacto('call-outline', `Llamar a ${f.nombre}`, `tel:${f.telefono}`) : null}
                {f.telefono ? contacto('logo-whatsapp', `WhatsApp a ${f.nombre}`, whatsapp(f.telefono)) : null}
                {f.email ? contacto('mail-outline', `Correo a ${f.nombre}`, `mailto:${f.email}`) : null}
                {!f.telefono && !f.email ? <Text style={styles.sub}>Sin datos de contacto</Text> : null}
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

function make_styles(colors: ReturnType<typeof useColors>, fs = 1) {
  return StyleSheet.create({
    screen:  { flex: 1, backgroundColor: colors.background },
    header:  { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
    title:   { color: colors.text, fontSize: 26 * fs, fontWeight: '700' },
    sub:     { color: colors.textSecondary, fontSize: 14 * fs },
    chips:   { flexDirection: 'row', gap: 8 },
    chip:    { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: colors.border },
    chipTxt: { color: colors.text, fontWeight: '600', fontSize: 14 * fs },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
    content: { paddingHorizontal: 20, paddingBottom: 32 },
    row:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
    name:    { color: colors.text, fontSize: 16 * fs, fontWeight: '700' },
    plan:    { color: colors.textSecondary, fontSize: 13 * fs },
    cuando:  { color: colors.text, fontSize: 14 * fs, fontWeight: '600', marginTop: 10 },
    contactos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    contacto:  { minHeight: 44, minWidth: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
                 borderRadius: 12, borderWidth: 1, borderColor: colors.border },
    contactoTxt: { color: colors.accent, fontWeight: '600', fontSize: 13 * fs },
    error:   { color: colors.error, fontSize: 14 * fs, marginBottom: 10 },
    empty:   { alignItems: 'center', paddingVertical: 40, gap: 10 },
    emptyTxt:{ color: colors.textMuted, fontSize: 14 * fs, textAlign: 'center' },
  });
}
