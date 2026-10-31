/**
 * Pantalla "Progreso y Salud" (rol Miembro) — historial de peso +
 * proyección por IA integrados en una sola gráfica, mapa muscular 2D y
 * timeline de mediciones.
 *
 * Rediseño: antes "Predicción de Peso" vivía en su propia pantalla
 * (prediccion.tsx, GET /api/analytics/regresion/predecir/<userId>) y se
 * alcanzaba desde aquí con un botón de acceso rápido. Ese archivo ya no
 * existe: su gráfica se fusionó directamente en la de abajo (ver
 * `datasetsGrafica`) y su bloque de "peso saludable" (criterio OMS) se
 * conserva tal cual, solo movido a este archivo. "Salud" (health.tsx) es
 * una pantalla distinta -- datos médicos/de medición, no proyección de
 * peso -- y sigue siendo un acceso rápido aparte, no se fusiona.
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, RefreshControl, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useColors, useFontScale } from '../../hooks/useColors';
import { conAlfa } from '../../constants/themes';
import { ENDPOINTS } from '../../constants/Api';
import { useFetch } from '../../hooks/useFetch';
import { useAuth } from '../../hooks/useAuth';
import { toDateStr, toArray } from '../../utils/format';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Card from '../../components/ui/Card';
import MuscleMap2D from '../../components/progress/MuscleMap2D';
import Button from '../../components/ui/Button';
import api from '../../services/api';
import type { BodyProgress } from '../../types';
import { estaConectado } from '../../services/offline/connectivity';
import { encolarAccion } from '../../services/offline/queue';

const SCREEN_W = Dimensions.get('window').width;
const RANGOS_PROYECCION = [30, 60, 90];

/** Extrae el valor de peso de un item de la predicción, tolerando varias formas del backend. */
function pesoVal(item: any): number | null {
  if (item == null) return null;
  if (typeof item === 'number') return item;
  const v = item.peso_predicho_kg ?? item.peso ?? item.valor;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

export default function ProgressScreen() {
  const colors = useColors();
  const fs = useFontScale();
  const styles = useMemo(() => make_styles(colors, fs), [colors, fs]);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // SCRUM-168 / HU-30: progreso corporal es una de las 4 lecturas que el
  // ticket pide cachear para consulta sin conexión.
  const { data: records, loading, refetch } =
    useFetch<BodyProgress[]>(ENDPOINTS.BODY_PROGRESS, undefined, { cache: true });
  const [modalVisible, setModalVisible] = useState(false);
  const [peso,    setPeso]    = useState('');
  const [cintura, setCintura] = useState('');
  const [cadera,  setCadera]  = useState('');
  const [saving,  setSaving]  = useState(false);

  const sorted = [...toArray<BodyProgress>(records)].sort(
    (a, b) => new Date(a.fecha_registro).getTime() - new Date(b.fecha_registro).getTime()
  );

  const chartData = sorted.slice(-10);
  const weights    = chartData.map((r) => r.peso);

  const last   = sorted[sorted.length - 1];
  const first  = sorted[0];
  const change = last && first ? (last.peso - first.peso).toFixed(1) : null;

  // ── Proyección de peso por IA (antes app/(member)/prediccion.tsx) ───────
  // Se fusiona aquí en vez de quedar como pantalla aparte: la gráfica de
  // abajo es una sola, con el histórico real y la proyección en la misma
  // línea de tiempo. El control [30][60][90 días] solo mueve el HORIZONTE
  // de la proyección a futuro -- el tramo histórico sigue siendo siempre
  // las últimas mediciones reales (`weights`, arriba), no algo que cambie
  // con el rango.
  const [diasProyeccion, setDiasProyeccion] = useState(30);
  const [predLoading, setPredLoading] = useState(true);
  const [predError, setPredError]     = useState<string | null>(null);
  const [pred, setPred]               = useState<number[]>([]);
  /** Rango de peso saludable (criterio OMS) que devuelve el backend. */
  const [rango, setRango] = useState<any>(null);

  const cargarPrediccion = useCallback(async () => {
    // Menos de 3 registros: ni siquiera se pide al backend (así lo hacía
    // prediccion.tsx) -- se muestra la tarjeta informativa en su lugar.
    if (!user?.id || sorted.length < 3) { setPredLoading(false); return; }
    setPredLoading(true); setPredError(null);
    try {
      const res = await api.get(`/analytics/regresion/predecir/${user.id}?dias=${diasProyeccion}`);
      const d = res.data ?? {};
      const p = (d.predicciones_futuras ?? []).map(pesoVal).filter((x: any): x is number => x != null);
      setPred(p);
      setRango(d.rango_saludable ?? null);
    } catch {
      setPred([]);
      setPredError('No se pudo calcular la predicción. Intenta de nuevo más tarde.');
    } finally {
      setPredLoading(false);
    }
  }, [user?.id, diasProyeccion, sorted.length]);

  useEffect(() => { cargarPrediccion(); }, [cargarPrediccion]);

  const hayProyeccion = sorted.length >= 3 && pred.length > 0;
  const pesoMeta = hayProyeccion ? pred[pred.length - 1] : null;

  // Dos datasets que comparten el mismo eje X aunque tengan distinta
  // longitud (react-native-chart-kit escala por el dataset MÁS LARGO, no
  // por índice propio): el real ("pasado", length = weights.length) se
  // dibuja arriba y sólido; el de proyección ("combinado" = pasado +
  // futuro, más largo) va debajo, traslúcido y punteado, así que donde se
  // solapan solo se ve el sólido, y a partir de "hoy" sigue solo punteado.
  // Se evita cualquier `null` en los datasets: en modo bezier, chart-kit no
  // los salta (a diferencia del modo recto) y puede romper la curva.
  const combinado = hayProyeccion ? [...weights, ...pred] : weights;
  const labelsGrafica = combinado.map((_, i) => (
    i === 0 ? 'inicio'
    : i === weights.length - 1 ? 'hoy'
    : i === combinado.length - 1 && hayProyeccion ? `+${diasProyeccion}d`
    : ''
  ));
  const datasetsGrafica = hayProyeccion
    ? [
        { data: combinado, color: (o = 1) => conAlfa(colors.dataIa, o * 0.6), strokeWidth: 2, strokeDashArray: [6, 5] },
        { data: weights,   color: (o = 1) => conAlfa(colors.dataProgreso, o), strokeWidth: 3 },
      ]
    : [{ data: weights, color: (o = 1) => conAlfa(colors.dataProgreso, o), strokeWidth: 2 }];

  // SCRUM-168 / HU-30: una medición es una escritura "segura" (no mueve
  // dinero) — se encola si no hay conexión en vez de perderse.
  const saveProgress = async () => {
    if (!peso) return;
    setSaving(true);
    const payload = {
      peso:    parseFloat(peso),
      cintura: cintura ? parseFloat(cintura) : undefined,
      cadera:  cadera  ? parseFloat(cadera)  : undefined,
    };
    const limpiarYCerrar = () => { setModalVisible(false); setPeso(''); setCintura(''); setCadera(''); };
    try {
      if (!estaConectado()) {
        await encolarAccion('BODY_PROGRESS', ENDPOINTS.USER_PROGRESS, payload);
        limpiarYCerrar();
        Alert.alert('Guardado sin conexión', 'Se registrará en cuanto vuelvas a tener internet.');
        return;
      }
      await api.post(ENDPOINTS.USER_PROGRESS, payload);
      limpiarYCerrar();
      refetch();
    } catch (e: any) {
      if (!e?.response) {
        // Se perdió la conexión justo al enviar: se encola en vez de
        // descartar lo que el socio acaba de teclear.
        await encolarAccion('BODY_PROGRESS', ENDPOINTS.USER_PROGRESS, payload);
        limpiarYCerrar();
        Alert.alert('Guardado sin conexión', 'Se registrará en cuanto vuelvas a tener internet.');
        return;
      }
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner fullScreen message="Cargando progreso…" />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.accent} />}
    >
      {/* Header */}
      <View style={styles.topRow}>
        <View>
          <Text style={styles.title} accessibilityRole="header">Progreso</Text>
          <Text style={styles.subtitle}>{sorted.length} registros totales</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setModalVisible(true)}
          accessibilityLabel="Registrar medición"
          accessibilityRole="button"
        >
          <Ionicons name="add" size={22} color={colors.onAccent} />
        </TouchableOpacity>
      </View>

      {/* Acceso rápido -- Salud (health.tsx) ya no vive en el cajón, se
          fusionó aquí "Progreso y Salud"; Predicción de Peso dejó de ser un
          acceso rápido porque ahora es parte de la gráfica de abajo. */}
      <TouchableOpacity
        style={styles.linkRow}
        onPress={() => router.push('/(member)/health')}
        accessibilityRole="button"
        accessibilityLabel="Ver Salud"
      >
        <Ionicons name="pulse-outline" size={18} color={colors.accent} />
        <Text style={styles.linkText}>Ver Salud</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Summary row */}
      {last && (
        <View style={styles.summaryRow}>
          <Card style={styles.summaryCard} padding={14}>
            <Text style={styles.sumLabel}>Peso actual</Text>
            <Text style={styles.sumValue}>{last.peso} <Text style={styles.sumUnit}>kg</Text></Text>
          </Card>
          {last.bmi && (
            <Card style={styles.summaryCard} padding={14}>
              <Text style={styles.sumLabel}>IMC</Text>
              <Text style={styles.sumValue}>{last.bmi}</Text>
            </Card>
          )}
          {change !== null && (
            <Card style={styles.summaryCard} padding={14}>
              <Text style={styles.sumLabel}>Cambio total</Text>
              <Text style={[styles.sumValue, {
                color: parseFloat(change) < 0 ? colors.success :
                       parseFloat(change) > 0 ? colors.error : colors.text
              }]}>
                {parseFloat(change) > 0 ? '+' : ''}{change} kg
              </Text>
            </Card>
          )}
          {hayProyeccion && pesoMeta != null && (
            <Card style={styles.summaryCard} padding={14}>
              <Text style={styles.sumLabel}>Proyección IA</Text>
              <Text style={[styles.sumValue, { color: colors.dataIa }]}>
                {pesoMeta.toFixed(1)} <Text style={styles.sumUnit}>kg</Text>
              </Text>
            </Card>
          )}
        </View>
      )}

      {/* Gráfica integrada de peso y proyección IA */}
      <Card padding={12}>
        <View style={styles.chartHeaderRow}>
          <Text style={styles.chartTitle}>Evolución y proyección (IA)</Text>
          <View style={styles.rangeRow}>
            {RANGOS_PROYECCION.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.rangeChip, diasProyeccion === r && styles.rangeChipActive]}
                onPress={() => setDiasProyeccion(r)}
                accessibilityRole="radio"
                accessibilityState={{ checked: diasProyeccion === r }}
                accessibilityLabel={`Proyectar a ${r} días`}
              >
                <Text style={[styles.rangeText, diasProyeccion === r && styles.rangeTextActive]}>{r}d</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {weights.length >= 2 ? (
          <LineChart
            data={{ labels: labelsGrafica, datasets: datasetsGrafica }}
            width={SCREEN_W - 64}
            height={190}
            chartConfig={{
              backgroundColor:      'transparent',
              backgroundGradientFrom: colors.card,
              backgroundGradientTo:   colors.card,
              decimalPlaces:          1,
              color:        (o = 1) => conAlfa(colors.dataProgreso, o),
              labelColor:   () => colors.textSecondary,
              propsForDots: { r: '4', strokeWidth: '2', stroke: colors.accentLight },
            }}
            bezier
            withDots={!hayProyeccion}
            style={{ borderRadius: 12 }}
            withInnerLines={false}
          />
        ) : (
          <View style={styles.emptyChart}>
            <Ionicons name="trending-up-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              Registra al menos 2 mediciones para ver la gráfica de evolución.
            </Text>
          </View>
        )}

        {sorted.length < 3 ? (
          <View style={styles.predInfoRow}>
            <Ionicons name="information-circle-outline" size={18} color={colors.info} />
            <Text style={styles.predInfoText}>
              Registra al menos 3 mediciones de peso para generar la predicción con IA.
            </Text>
          </View>
        ) : predLoading ? (
          <Text style={styles.predHint}>Calculando tu predicción…</Text>
        ) : predError ? (
          <Text style={styles.predHint}>{predError}</Text>
        ) : hayProyeccion && (
          <Text style={styles.disclaimer}>
            Línea punteada = proyección a {diasProyeccion} días según tu tendencia actual;
            no sustituye la valoración de un profesional.
          </Text>
        )}
      </Card>

      {/* Peso saludable según la OMS (criterio clínico, no un "peso ideal":
          el IMC es cribado poblacional y no distingue músculo de grasa). */}
      {rango && hayProyeccion && (
        <Card>
          <Text style={styles.chartTitle}>Peso saludable para tu estatura</Text>
          <Text style={styles.rangoValor}>
            {rango.peso_min_kg} – {rango.peso_max_kg} <Text style={styles.sumUnit}>kg</Text>
          </Text>
          <Text style={styles.rangoMeta}>
            Criterio OMS · IMC {rango.imc_min}–{rango.imc_max} · {rango.estatura_m} m
          </Text>
          {rango.imc_actual != null && (
            <Text style={styles.rangoTexto}>
              Tu IMC es {rango.imc_actual} ({rango.categoria}).{' '}
              {rango.dentro_del_rango
                ? 'Estás dentro del rango.'
                : `Te separan ${rango.diferencia_kg} kg del límite ${rango.direccion === 'bajar' ? 'superior' : 'inferior'}.`}
            </Text>
          )}
          {!!rango.advertencia && <Text style={styles.rangoNota}>{rango.advertencia}</Text>}
        </Card>
      )}

      {/* Mapa muscular 2D (SCRUM-101) — volumen de trabajo por grupo muscular,
          tomado de la bitácora. Leyenda interactiva: tocar un grupo lo
          resalta en la silueta (ver components/progress/MuscleMap2D.tsx). */}
      <MuscleMap2D />

      {/* Historial de mediciones */}
      <Card>
        <Text style={styles.chartTitle}>Historial de mediciones</Text>
        {sorted.length === 0 ? (
          <Text style={styles.emptyText}>No hay registros aún.</Text>
        ) : (
          [...sorted].reverse().slice(0, 15).map((r, i, arr) => {
            // Diferencial contra el registro INMEDIATAMENTE anterior en el
            // tiempo -- como la lista está invertida (más reciente primero),
            // ese anterior es el siguiente elemento del propio arreglo.
            const anterior = arr[i + 1];
            const diferencial = anterior ? +(r.peso - anterior.peso).toFixed(1) : null;
            return (
              <View key={r._id} style={styles.histRow}>
                {r.foto ? (
                  <Image source={{ uri: r.foto }} style={styles.histFoto} />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={styles.histDate}>{toDateStr(r.fecha_registro)}</Text>
                  <View style={styles.histMeasures}>
                    {r.cintura && <Text style={styles.histMini}>Cintura: {r.cintura}cm</Text>}
                    {r.cadera  && <Text style={styles.histMini}>Cadera: {r.cadera}cm</Text>}
                    {r.bmi     && <Text style={styles.histMini}>IMC: {r.bmi}</Text>}
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.histPeso}>{r.peso} <Text style={styles.histUnit}>kg</Text></Text>
                  {diferencial != null && diferencial !== 0 && (
                    <Text style={[styles.histDiff, { color: diferencial < 0 ? colors.success : colors.error }]}>
                      {diferencial > 0 ? '+' : ''}{diferencial} kg
                    </Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </Card>

      {/* Modal — nueva medición */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nueva medición</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} accessibilityLabel="Cerrar">
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Peso (kg) *</Text>
            <TextInput
              style={styles.modalInput}
              value={peso}
              onChangeText={setPeso}
              keyboardType="decimal-pad"
              placeholder="e.g. 72.5"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Peso en kilogramos"
            />
            <Text style={styles.inputLabel}>Cintura (cm)</Text>
            <TextInput
              style={styles.modalInput}
              value={cintura}
              onChangeText={setCintura}
              keyboardType="decimal-pad"
              placeholder="e.g. 80"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Cintura en centímetros"
            />
            <Text style={styles.inputLabel}>Cadera (cm)</Text>
            <TextInput
              style={styles.modalInput}
              value={cadera}
              onChangeText={setCadera}
              keyboardType="decimal-pad"
              placeholder="e.g. 95"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Cadera en centímetros"
            />
            <Button label="Guardar" onPress={saveProgress} loading={saving} disabled={!peso} style={{ marginTop: 8 }} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function make_styles(colors: ReturnType<typeof useColors>, fs = 1) {
  return StyleSheet.create({
  screen:   { flex: 1, backgroundColor: colors.background },
  content:  { padding: 20, gap: 16, paddingBottom: 32 },
  topRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title:    { color: colors.text, fontSize: 26 * fs, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 13 * fs },
  addBtn: {
    width:  44, height: 44, borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, padding: 14,
  },
  linkText: { color: colors.text, fontSize: 14 * fs, fontWeight: '600', flex: 1 },
  summaryRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  summaryCard: { flex: 1, minWidth: '45%' },
  sumLabel:    { color: colors.textSecondary, fontSize: 11 * fs, marginBottom: 4 },
  sumValue:    { color: colors.text, fontSize: 20 * fs, fontWeight: '700' },
  sumUnit:     { fontSize: 13 * fs, color: colors.textSecondary },
  chartHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 },
  chartTitle:  { color: colors.text, fontSize: 15 * fs, fontWeight: '700' },
  rangeRow: { flexDirection: 'row', gap: 6 },
  rangeChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  rangeChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  rangeText:       { color: colors.textSecondary, fontSize: 12 * fs, fontWeight: '600' },
  rangeTextActive: { color: colors.onAccent },
  emptyChart:  { alignItems: 'center', paddingVertical: 24, gap: 10 },
  emptyText:   { color: colors.textMuted, fontSize: 13 * fs, textAlign: 'center', lineHeight: 20 },
  predInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14,
                 backgroundColor: colors.infoBg, padding: 10, borderRadius: 10 },
  predInfoText:{ color: colors.info, fontSize: 12.5 * fs, flex: 1, lineHeight: 18 * fs },
  predHint:    { color: colors.textMuted, fontSize: 12 * fs, marginTop: 12, textAlign: 'center' },
  disclaimer:  { color: colors.textMuted, fontSize: 11 * fs, fontStyle: 'italic', marginTop: 12, lineHeight: 16 },
  rangoValor:  { color: colors.accent, fontSize: 24 * fs, fontWeight: '800', marginTop: 4 },
  rangoMeta:   { color: colors.textSecondary, fontSize: 11 * fs, marginTop: 2 },
  rangoTexto:  { color: colors.text, fontSize: 13 * fs, marginTop: 8, lineHeight: 19 * fs },
  rangoNota:   { color: colors.textSecondary, fontSize: 11 * fs, marginTop: 8, lineHeight: 16 * fs },
  histRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  histFoto:     { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.surface },
  histDate:     { color: colors.text, fontSize: 14 * fs, fontWeight: '600' },
  histMeasures: { flexDirection: 'row', gap: 8, marginTop: 2 },
  histMini:     { color: colors.textMuted, fontSize: 11 * fs },
  histPeso:     { color: colors.accent, fontSize: 18 * fs, fontWeight: '700' },
  histUnit:     { fontSize: 13 * fs, color: colors.textSecondary },
  histDiff:     { fontSize: 11 * fs, fontWeight: '700', marginTop: 2 },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle:  { color: colors.text, fontSize: 18 * fs, fontWeight: '700' },
  inputLabel:  { color: colors.textSecondary, fontSize: 13 * fs, marginBottom: 4, marginTop: 8 },
  modalInput: {
    backgroundColor: colors.inputBg, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    color: colors.text, padding: 14, fontSize: 15 * fs,
  },
});
}
