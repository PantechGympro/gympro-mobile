/**
 * Pagos por confirmar — pantalla compartida por Propietario/Administrador y
 * Recepción (equivalente móvil de web/src/pages/compartido/PagosPorConfirmar.jsx).
 *
 * Lista los pagos que el MIEMBRO declaró a mano y nadie ha verificado:
 *   - compras de tienda con Efectivo / Transferencia / TotalPass
 *   - renovaciones de membresía con Efectivo / Transferencia
 * Confirmar una renovación ACTIVA la membresía; confirmar una compra la deja
 * pagada y lista para entregar; rechazar cancela (y en tienda devuelve el stock).
 * PayPal y Mercado Pago no aparecen: los verifica el webhook de la pasarela.
 *
 * Contrato (GET /api/confirmaciones-pago):
 *   { ventas: [...], renovaciones: [...], total }
 *   POST /api/confirmaciones-pago/{ventas|renovaciones}/<id>/{confirmar|rechazar}
 * El API responde 403 a quien no sea recepción/administración/propietario y 409
 * si otra persona ya resolvió el pago.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, useFontScale } from '../../hooks/useColors';
import { ENDPOINTS } from '../../constants/Api';
import { useFetch } from '../../hooks/useFetch';
import { toArray } from '../../utils/format';
import api from '../../services/api';
import LoadingSpinner from '../ui/LoadingSpinner';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

interface Pendiente {
  tipo: 'venta' | 'renovacion';
  id: string;
  nombre_miembro?: string;
  items?: { nombre: string; qty?: number; cantidad?: number }[];
  membresia_nombre?: string;
  total: number;
  metodo_pago: string;
  referencia?: string | null;
  fecha?: string | null;
  fecha_recogida?: string | null;
  hora_recogida?: string | null;
}
interface Respuesta { ventas: Pendiente[]; renovaciones: Pendiente[]; total: number }

type Filtro = 'todos' | 'renovacion' | 'venta';
const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'todos', label: 'Todos' }, { id: 'renovacion', label: 'Renovaciones' }, { id: 'venta', label: 'Tienda' },
];

const money = (n: number) =>
  `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const concepto = (p: Pendiente) =>
  p.tipo === 'renovacion'
    ? `Renovación · ${p.membresia_nombre ?? 'Membresía'}`
    : toArray<NonNullable<Pendiente['items']>[number]>(p.items)
        .map((i) => `${i.qty ?? i.cantidad ?? 1}× ${i.nombre}`).join(', ') || 'Compra';

const hace = (iso?: string | null) => {
  if (!iso) return '';
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
};

/** Qué debe comprobar quien confirma, según el método que declaró el miembro. */
const instruccion = (p: Pendiente) =>
  p.metodo_pago === 'Transferencia'
    ? `Confirma que la transferencia de ${money(p.total)} ya aparece en el estado de cuenta.`
    : p.metodo_pago === 'TotalPass'
      ? 'Confirma que la compra está cubierta por TotalPass.'
      : `Confirma que recibiste ${money(p.total)} en efectivo.`;

export default function PorConfirmarScreen() {
  const colors = useColors();
  const fs = useFontScale();
  const styles = useMemo(() => make_styles(colors, fs), [colors, fs]);
  const insets = useSafeAreaInsets();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [trabajando, setTrabajando] = useState<string | null>(null);

  const { data, loading, error, refetch } = useFetch<Respuesta>(ENDPOINTS.CONFIRMACIONES_PAGO);

  // Lo más antiguo primero: es lo que más lleva esperando.
  const filas = useMemo(() => {
    const todas = [...toArray<Pendiente>(data?.renovaciones), ...toArray<Pendiente>(data?.ventas)]
      .sort((a, b) => new Date(a.fecha ?? 0).getTime() - new Date(b.fecha ?? 0).getTime());
    return filtro === 'todos' ? todas : todas.filter((p) => p.tipo === filtro);
  }, [data, filtro]);

  const total = toArray(data?.ventas).length + toArray(data?.renovaciones).length;

  const resolver = async (p: Pendiente, accion: 'confirmar' | 'rechazar') => {
    const ruta = `${ENDPOINTS.CONFIRMACIONES_PAGO}/${p.tipo === 'venta' ? 'ventas' : 'renovaciones'}/${p.id}/${accion}`;
    setTrabajando(p.id);
    try {
      await api.post(ruta);
      refetch();
    } catch (e: any) {
      Alert.alert('No se pudo completar', e?.response?.data?.error ?? 'Intenta de nuevo.');
      if (e?.response?.status === 409) refetch();   // otra persona ya lo resolvió
    } finally {
      setTrabajando(null);
    }
  };

  const confirmar = (p: Pendiente) => Alert.alert(
    '¿Confirmar pago?',
    `${p.nombre_miembro ?? 'Miembro'}\n${concepto(p)}\n${money(p.total)} · ${p.metodo_pago}`
      + `${p.referencia ? `\nRef. ${p.referencia}` : ''}\n\n${instruccion(p)}\n`
      + (p.tipo === 'renovacion' ? 'Al confirmar, la membresía se activa de inmediato.'
                                  : 'Al confirmar, la compra queda pagada y lista para entregar.'),
    [{ text: 'Cancelar', style: 'cancel' }, { text: 'Pago verificado', onPress: () => resolver(p, 'confirmar') }],
  );

  const rechazar = (p: Pendiente) => Alert.alert(
    '¿Rechazar este pago?',
    `${p.nombre_miembro ?? 'Miembro'} · ${concepto(p)} · ${money(p.total)}\n\n`
      + (p.tipo === 'renovacion' ? 'La membresía NO se activará.'
                                  : 'La compra se cancela y el producto vuelve al inventario.')
      + ' El miembro recibirá un aviso.',
    [{ text: 'Cancelar', style: 'cancel' },
     { text: 'Rechazar', style: 'destructive', onPress: () => resolver(p, 'rechazar') }],
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title} accessibilityRole="header">
          Pagos por confirmar{total > 0 ? ` (${total})` : ''}
        </Text>
        <Text style={styles.sub}>
          Efectivo, transferencia o TotalPass que el miembro declaró. No cuentan como ingreso ni se activan
          o entregan hasta que los verifiques. PayPal y Mercado Pago se validan solos.
        </Text>
        <View style={styles.chips}>
          {FILTROS.map((f) => (
            <TouchableOpacity key={f.id} onPress={() => setFiltro(f.id)} accessibilityRole="button"
              accessibilityState={{ selected: filtro === f.id }}
              style={[styles.chip, filtro === f.id && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
              <Text style={[styles.chipTxt, filtro === f.id && { color: colors.onAccent }]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading && filas.length === 0 ? (
        <LoadingSpinner fullScreen message="Buscando pagos pendientes…" />
      ) : (
        <FlatList
          data={filas}
          keyExtractor={(p) => `${p.tipo}-${p.id}`}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.accent} />}
          ListHeaderComponent={error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={44} color={colors.textMuted} />
              <Text style={styles.emptyTxt}>No hay pagos por confirmar.</Text>
            </View>
          }
          renderItem={({ item: p }) => {
            const ocupado = trabajando === p.id;
            return (
              <Card style={{ marginBottom: 10 }}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{p.nombre_miembro || 'Miembro'}</Text>
                    <Text style={styles.plan}>{concepto(p)}</Text>
                  </View>
                  <Badge label={p.tipo === 'renovacion' ? 'Renovación' : 'Tienda'} color="accent" />
                </View>
                <Text style={styles.monto}>{money(p.total)}</Text>
                <Text style={styles.meta}>
                  {p.metodo_pago}{p.referencia ? `  ·  Ref. ${p.referencia}` : ''}{p.fecha ? `  ·  ${hace(p.fecha)}` : ''}
                </Text>
                {p.tipo === 'venta' && p.fecha_recogida ? (
                  <Text style={styles.meta}>Recoge {p.fecha_recogida} · {p.hora_recogida}</Text>
                ) : null}
                <View style={styles.acciones}>
                  <Button label="Rechazar" variant="secondary" size="sm" disabled={ocupado}
                    onPress={() => rechazar(p)} accessibilityLabel={`Rechazar pago de ${p.nombre_miembro ?? 'miembro'}`} />
                  <Button label="Confirmar pago" size="sm" loading={ocupado} disabled={ocupado}
                    onPress={() => confirmar(p)} accessibilityLabel={`Confirmar pago de ${p.nombre_miembro ?? 'miembro'}`} />
                </View>
              </Card>
            );
          }}
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
    sub:     { color: colors.textSecondary, fontSize: 13 * fs, lineHeight: 19 * fs },
    chips:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip:    { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: colors.border },
    chipTxt: { color: colors.text, fontWeight: '600', fontSize: 14 * fs },
    content: { paddingHorizontal: 20, paddingBottom: 32 },
    row:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
    name:    { color: colors.text, fontSize: 16 * fs, fontWeight: '700' },
    plan:    { color: colors.textSecondary, fontSize: 13 * fs },
    monto:   { color: colors.text, fontSize: 22 * fs, fontWeight: '800', marginTop: 10 },
    meta:    { color: colors.textSecondary, fontSize: 13 * fs, marginTop: 4 },
    acciones:{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
    error:   { color: colors.error, fontSize: 14 * fs, marginBottom: 10 },
    empty:   { alignItems: 'center', paddingVertical: 40, gap: 10 },
    emptyTxt:{ color: colors.textMuted, fontSize: 14 * fs, textAlign: 'center' },
  });
}
