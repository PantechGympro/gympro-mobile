/**
 * Pantalla "Logros y Medallas" (HU-26 / SCRUM-206) — rol Miembro.
 *
 * Vista de perfil con los logros conseguidos y los pendientes, agrupados por
 * familia (racha, rutinas, constancia, superación personal, primeros
 * pasos), cada uno con su progreso hacia el siguiente nivel. Los rangos por
 * grupo muscular (la otra mitad del alcance de HU-26) ya se muestran en el
 * mapa 2D de la pantalla "Progreso y Salud" (ver components/progress/
 * MuscleMap2D.tsx, SCRUM-101) — aquí solo se enlaza hacia allá en vez de
 * duplicar esa vista.
 *
 * Contrato real del backend (api/app/routes/miembro/logros.py):
 *   GET /api/user/logros → { logros: Logro[], resumen: { conseguidos, total, siguientes } }
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useColors, useFontScale } from '../../hooks/useColors';
import { ENDPOINTS } from '../../constants/Api';
import { useFetch } from '../../hooks/useFetch';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Card from '../../components/ui/Card';
import type { Logro, LogrosResponse } from '../../types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TITULOS_FAMILIA: Record<Logro['familia'], string> = {
  primera_vez: 'Primeros pasos',
  racha:       'Racha de asistencia',
  rutinas:     'Rutinas completadas',
  constancia:  'Constancia mensual',
  superacion:  'Superación personal',
};

const ORDEN_FAMILIA: Logro['familia'][] = ['primera_vez', 'racha', 'rutinas', 'constancia', 'superacion'];

/** "2026-11-06" → "06/11/2026". El backend ya entrega la fecha recortada a YYYY-MM-DD. */
function formatoFecha(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function MedallaRow({ logro }: { logro: Logro }) {
  const colors = useColors();
  const fs = useFontScale();
  const styles = useMemo(() => makeRowStyles(colors, fs), [colors, fs]);

  const pct = logro.en_revision || logro.progreso == null
    ? 0
    : Math.min(100, Math.round((logro.progreso / logro.objetivo) * 100));

  return (
    <View style={styles.row} accessible
          accessibilityLabel={`${logro.nombre}: ${logro.conseguido ? `conseguido el ${formatoFecha(logro.fecha_obtencion!)}` : `progreso ${logro.progreso ?? 0} de ${logro.objetivo}`}`}>
      <View style={[styles.iconBox, { backgroundColor: logro.conseguido ? `${logro.color}22` : colors.border }]}>
        <Ionicons
          name={`${logro.icono}${logro.conseguido ? '' : '-outline'}` as IconName}
          size={20}
          color={logro.conseguido ? logro.color : colors.textMuted}
        />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.tituloRow}>
          <Text style={[styles.nombre, !logro.conseguido && { color: colors.textSecondary }]}>{logro.nombre}</Text>
          {logro.conseguido && (
            <View style={[styles.nivelChip, { backgroundColor: `${logro.color}22` }]}>
              <Text style={[styles.nivelTexto, { color: logro.color }]}>{logro.nivel}</Text>
            </View>
          )}
        </View>
        <Text style={styles.descripcion}>{logro.descripcion}</Text>

        {logro.conseguido ? (
          <Text style={styles.fecha}>Conseguido el {formatoFecha(logro.fecha_obtencion!)}</Text>
        ) : logro.en_revision ? (
          <Text style={styles.enRevision}>Métricas en revisión — se actualizará pronto.</Text>
        ) : (
          <View style={styles.progresoBox}>
            <View style={styles.progresoFondo}>
              <View style={[styles.progresoRelleno, { width: `${pct}%`, backgroundColor: colors.accent }]} />
            </View>
            <Text style={styles.progresoTexto}>{logro.progreso ?? 0} / {logro.objetivo}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function LogrosScreen() {
  const colors = useColors();
  const fs = useFontScale();
  const styles = useMemo(() => makeStyles(colors, fs), [colors, fs]);
  const insets = useSafeAreaInsets();

  const { data, loading, error, refetch } = useFetch<LogrosResponse>(ENDPOINTS.LOGROS);

  const porFamilia = useMemo(() => {
    const grupos: Record<string, Logro[]> = {};
    for (const l of data?.logros ?? []) {
      (grupos[l.familia] ??= []).push(l);
    }
    for (const familia of Object.keys(grupos)) {
      grupos[familia].sort((a, b) => a.objetivo - b.objetivo);
    }
    return grupos;
  }, [data]);

  if (loading) {
    return <LoadingSpinner fullScreen message="Cargando tus logros…" />;
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.accent} />}
    >
      {error ? (
        <Card>
          <Text style={styles.errorText}>No se pudieron cargar tus logros. Desliza para reintentar.</Text>
        </Card>
      ) : (
        <>
          <Card elevated style={styles.resumenCard}>
            <View style={styles.resumenRow}>
              <Ionicons name="trophy" size={28} color={colors.accent} />
              <View>
                <Text style={styles.resumenNumero}>
                  {data?.resumen.conseguidos ?? 0} <Text style={styles.resumenTotal}>/ {data?.resumen.total ?? 0}</Text>
                </Text>
                <Text style={styles.resumenLabel}>logros conseguidos</Text>
              </View>
            </View>
          </Card>

          {ORDEN_FAMILIA.filter((f) => porFamilia[f]?.length).map((familia) => (
            <Card key={familia} style={styles.familiaCard}>
              <Text style={styles.familiaTitulo}>{TITULOS_FAMILIA[familia]}</Text>
              {porFamilia[familia].map((logro, i) => (
                <View key={logro.id}>
                  {i > 0 && <View style={styles.separador} />}
                  <MedallaRow logro={logro} />
                </View>
              ))}
            </Card>
          ))}

          <TouchableOpacity
            style={styles.enlaceMapa}
            onPress={() => router.push('/(member)/progress')}
            accessibilityRole="button"
            accessibilityLabel="Ver mapa muscular y rangos por grupo muscular"
          >
            <Ionicons name="body-outline" size={16} color={colors.accent} />
            <Text style={styles.enlaceMapaTexto}>Ver mapa muscular y rangos por grupo →</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, fs = 1) {
  return StyleSheet.create({
    screen:  { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, gap: 16, paddingBottom: 40 },
    errorText: { fontSize: 14 * fs, color: colors.error, textAlign: 'center', padding: 8 },
    resumenCard: { flexDirection: 'row' },
    resumenRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    resumenNumero: { fontSize: 28 * fs, fontWeight: '800', color: colors.text },
    resumenTotal: { fontSize: 16 * fs, fontWeight: '600', color: colors.textSecondary },
    resumenLabel: { fontSize: 13 * fs, color: colors.textSecondary, marginTop: 2 },
    familiaCard: { gap: 0 },
    familiaTitulo: { fontSize: 15 * fs, fontWeight: '700', color: colors.text, marginBottom: 12 },
    separador: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
    enlaceMapa: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
    enlaceMapaTexto: { fontSize: 13 * fs, color: colors.accent, fontWeight: '600' },
  });
}

function makeRowStyles(colors: ReturnType<typeof useColors>, fs = 1) {
  return StyleSheet.create({
    row:            { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    iconBox:        { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    tituloRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    nombre:         { fontSize: 14 * fs, fontWeight: '700', color: colors.text },
    nivelChip:      { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    nivelTexto:     { fontSize: 10 * fs, fontWeight: '700', textTransform: 'uppercase' },
    descripcion:    { fontSize: 12.5 * fs, color: colors.textSecondary, marginTop: 2 },
    fecha:          { fontSize: 11.5 * fs, color: colors.success, fontWeight: '600', marginTop: 6 },
    enRevision:     { fontSize: 11.5 * fs, color: colors.warning, fontStyle: 'italic', marginTop: 6 },
    progresoBox:    { marginTop: 8, gap: 4 },
    progresoFondo:  { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
    progresoRelleno:{ height: 6, borderRadius: 3 },
    progresoTexto:  { fontSize: 11 * fs, color: colors.textMuted },
  });
}
