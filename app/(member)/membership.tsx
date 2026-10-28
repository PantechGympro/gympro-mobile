/**
 * Pantalla "Membresía y Pagos" — estado de la membresía, apartado de
 * renovación y el historial financiero, todo en una sola pantalla.
 *
 * Contratos reales del backend (api/app/routes/miembro/user_membership.py):
 *   GET  /api/user/membership        → { tieneMembresia, membresia?, mensaje? }
 *   GET  /api/user/membership/plans  → { planes: [...] }
 *   POST /api/user/membership/renew  → body { id_membresia, metodo_pago }
 *                                       metodo_pago ∈ Efectivo | PayPal | Mercado Pago
 *   GET  /api/user/payments          → { stats: {...}, payments: [...] }
 *
 * Rediseño: antes "Pagos" era una pantalla propia (payments.tsx), alcanzable
 * solo con el enlace "Ver historial de pagos" al fondo de esta pantalla. Esa
 * pantalla ya no existe -- su resumen financiero y su historial de
 * transacciones se fusionaron aquí abajo tal cual, con el estado (badge de
 * cada transacción) ahora explícito en vez de texto plano. Toda la lógica de
 * renovación/pago (carrusel de planes, pasarelas, bloqueo sin conexión por
 * SCRUM-168/HU-30) se deja exactamente igual: es dinero real, no se toca.
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, useFontScale } from '../../hooks/useColors';
import { ENDPOINTS } from '../../constants/Api';
import { useFetch } from '../../hooks/useFetch';
import { toDateStr, toArray } from '../../utils/format';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import api from '../../services/api';
import {
  getMetodosPago, pagarEnApp, mensajePorEstado,
  type MetodoPago as MetodoPagoDisponible, type ProveedorPago,
} from '../../services/pagos';
import type {
  MembershipResponse, PlansResponse, MembershipPlan, MetodoPago,
  PaymentsResponse, PaymentItem,
} from '../../types';
import { estaConectado, useConnectivityStore } from '../../services/offline/connectivity';

// Carrusel de planes: la tarjeta no ocupa todo el ancho para que asome la
// siguiente y se entienda que el listado se desliza en horizontal.
const SCREEN_W  = Dimensions.get('window').width;
const CARD_GAP  = 12;
const CARD_W    = Math.min(300, SCREEN_W * 0.76);

type FiltroPagos = 'todos' | 'membresia' | 'producto';

function estadoBadge(estado: string): { label: string; color: 'success' | 'warning' | 'error' } {
  if (estado === 'activa')     return { label: 'Activa',     color: 'success' };
  if (estado === 'por_vencer') return { label: 'Por vencer', color: 'warning' };
  return { label: 'Vencida', color: 'error' };
}

function methodIcon(method: string): React.ComponentProps<typeof Ionicons>['name'] {
  const m = (method || '').toLowerCase();
  if (m.includes('paypal'))   return 'logo-paypal';
  if (m.includes('mercado'))  return 'wallet-outline';
  if (m.includes('tarjeta'))  return 'card-outline';
  if (m.includes('transfer')) return 'swap-horizontal-outline';
  return 'cash-outline';
}

export default function MembershipScreen() {
  const colors = useColors();
  const fs = useFontScale();
  const styles = useMemo(() => make_styles(colors, fs), [colors, fs]);
  const insets = useSafeAreaInsets();

  // SCRUM-168 / HU-30: el estado de membresía es una de las 4 lecturas que
  // el ticket pide cachear — el socio debe poder ver si está "al día" sin
  // señal, aunque no pueda renovar sin conexión (ver doRenew/pagarEnLinea).
  const { data, loading, refetch } =
    useFetch<MembershipResponse>(ENDPOINTS.USER_MEMBERSHIP, undefined, { cache: true });
  const { data: plansData, loading: loadingPlans } = useFetch<PlansResponse>(ENDPOINTS.MEMBERSHIP_PLANS);
  const { data: pagosData, loading: loadingPagos, refetch: refetchPagos } =
    useFetch<PaymentsResponse>(ENDPOINTS.USER_PAYMENTS);
  const conectado = useConnectivityStore((s) => s.conectado);

  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);
  const [metodo, setMetodo]   = useState<MetodoPago>('Efectivo');
  const [renewing, setRenewing] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(0);   // posición en el carrusel
  const [filtroPagos, setFiltroPagos] = useState<FiltroPagos>('todos');
  // Efectivo + las pasarelas activas del gimnasio (PayPal / Mercado Pago)
  const [pasarelas, setPasarelas] = useState<MetodoPagoDisponible[]>([]);
  // HU-30: si falla por falta de red (no hubo respuesta del servidor), los
  // métodos digitales se muestran deshabilitados con un mensaje — nunca
  // simplemente ocultos, para no confundir "sin internet" con "el gimnasio
  // no tiene pasarelas configuradas".
  const [pagosSinConexion, setPagosSinConexion] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const lista = await getMetodosPago();
        if (vivo) { setPasarelas(lista); setPagosSinConexion(false); }
      } catch (err: any) {
        if (!vivo) return;
        setPasarelas([]);
        // Sin "response" → la petición no llegó al servidor (sin conexión).
        setPagosSinConexion(!err?.response);
      }
    })();
    return () => { vivo = false; };
  }, []);

  const metodosPago = useMemo(() => ([
    { id: 'Efectivo', label: 'Efectivo', esPasarela: false, proveedor: null as ProveedorPago | null },
    ...pasarelas.map((p) => ({
      id: p.proveedor as string,
      label: p.nombre,
      esPasarela: true,
      proveedor: p.proveedor,
    })),
  ]), [pasarelas]);

  const planes = plansData?.planes ?? [];

  // ── Historial de pagos (antes app/(member)/payments.tsx) ────────────────
  const statsPagos     = pagosData?.stats;
  const todosPagos      = toArray<PaymentItem>(pagosData?.payments);
  const pagosFiltrados  = filtroPagos === 'todos' ? todosPagos : todosPagos.filter((p) => p.type === filtroPagos);
  const hayComprasPOS   = todosPagos.some((p) => p.type === 'producto');

  // SCRUM-168 / HU-30: renovar es un movimiento de dinero (incluso en
  // "Efectivo" — activa la membresía de inmediato) y el ticket exige que
  // NINGÚN movimiento de dinero quede en cola. Se bloquea por completo sin
  // conexión, nunca se encola para reintentar después.
  const doRenew = async () => {
    if (!selectedPlan) return;
    if (!estaConectado()) {
      Alert.alert(
        'Sin conexión',
        'No puedes renovar tu membresía sin conexión a internet. Ningún pago o renovación se procesa sin conexión — intenta de nuevo cuando la recuperes.',
      );
      return;
    }
    setRenewing(true);
    try {
      await api.post(ENDPOINTS.MEMBERSHIP_RENEW, {
        id_membresia: selectedPlan.id_membresia,
        metodo_pago:  metodo,
      });
      Alert.alert('¡Listo!', `Membresía "${selectedPlan.nombre}" renovada con éxito.`);
      setShowRenew(false);
      setSelectedPlan(null);
      refetch();
      refetchPagos();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo renovar la membresía');
    } finally {
      setRenewing(false);
    }
  };

  /** Cobro en línea: abre la pasarela y confirma el resultado al volver. */
  const pagarEnLinea = async (proveedor: ProveedorPago) => {
    if (!selectedPlan) return;
    if (!estaConectado()) {
      Alert.alert(
        'Sin conexión',
        'No puedes pagar en línea sin conexión a internet. Intenta de nuevo cuando la recuperes.',
      );
      return;
    }
    setPagando(true);
    try {
      const res = await pagarEnApp({
        proveedor,
        contexto: 'membresia',
        monto: Number(selectedPlan.precio),
        descripcion: `Membresía ${selectedPlan.nombre}`,
        referenciaLocal: selectedPlan.id_membresia,
      });
      const info = mensajePorEstado(res.estado);
      Alert.alert(info.titulo, res.mensaje ?? info.texto);
      if (res.estado === 'aprobado' || res.estado === 'pendiente') {
        setShowRenew(false);
        setSelectedPlan(null);
        refetch();
        refetchPagos();
      }
    } catch (e: any) {
      Alert.alert('No se pudo iniciar el pago',
        e?.response?.data?.msg ?? 'Intenta de nuevo más tarde.');
    } finally {
      setPagando(false);
    }
  };

  const confirmRenew = () => {
    if (!selectedPlan) return;

    // Con PayPal o Mercado Pago el cobro ocurre en la pasarela
    const metodoSel = metodosPago.find((m) => m.id === metodo);
    if (metodoSel?.esPasarela && metodoSel.proveedor) {
      pagarEnLinea(metodoSel.proveedor);
      return;
    }

    Alert.alert(
      'Confirmar renovación',
      `${selectedPlan.nombre}\nMétodo: ${metodo}\nTotal: $${selectedPlan.precio}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: doRenew },
      ],
    );
  };

  if (loading) return <LoadingSpinner fullScreen message="Cargando membresía…" />;

  const membership = data?.tieneMembresia ? data.membresia : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.accent} />}
    >
      <Text style={styles.title} accessibilityRole="header">Membresía y Pagos</Text>

      {/* ── Pase de membresía (hero) ──────────────────────────────── */}
      {membership ? (
        <Card elevated style={styles.pase}>
          <View style={styles.memHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.paseTag}>
                <Ionicons name="ticket-outline" size={12} color={colors.accent} />
                <Text style={styles.paseTagText}>PASE DE MEMBRESÍA</Text>
              </View>
              <Text style={styles.memName}>{membership.nombre}</Text>
              <Text style={styles.memPrice}>${membership.precio} <Text style={styles.memPriceUnit}>/ periodo</Text></Text>
            </View>
            <Badge {...estadoBadge(membership.estado)} />
          </View>

          <View style={styles.daysBox}>
            <Text style={styles.daysNum}>{Math.max(0, membership.diasRestantes)}</Text>
            <Text style={styles.daysLabel}>días restantes</Text>
          </View>

          {/* Línea perforada -- refuerza la idea de "pase/boleto" entre el
              bloque de días y las fechas, como el talón de un ticket. */}
          <View style={styles.perforacion} />

          <View style={styles.datesRow}>
            <View style={styles.dateCol}>
              <Text style={styles.dateLabel}>Inicio</Text>
              <Text style={styles.dateValue}>{toDateStr(membership.fechaInicio)}</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
            <View style={[styles.dateCol, { alignItems: 'flex-end' }]}>
              <Text style={styles.dateLabel}>Vence</Text>
              <Text style={styles.dateValue}>{toDateStr(membership.fechaFin)}</Text>
            </View>
          </View>

          {membership.diasRestantes <= 7 && (
            <View style={styles.warnRow}>
              <Ionicons name="alert-circle" size={16} color={colors.warning} />
              <Text style={styles.warnText}>Tu membresía está por vencer. Renueva para no perder acceso.</Text>
            </View>
          )}
        </Card>
      ) : (
        <Card>
          <View style={styles.noMem}>
            <Ionicons name="card-outline" size={40} color={colors.textMuted} />
            <Text style={styles.noMemText}>No tienes una membresía activa.</Text>
            <Text style={styles.noMemSub}>{data?.mensaje ?? 'Contrata un plan para seguir entrenando.'}</Text>
          </View>
        </Card>
      )}

      {/* ── Botón abrir/cerrar apartado de renovación (justo debajo del pase) ── */}
      <Button
        label={showRenew ? 'Cerrar' : (membership ? 'Renovar membresía' : 'Contratar plan')}
        variant={showRenew ? 'secondary' : 'primary'}
        onPress={() => setShowRenew((v) => !v)}
        icon={<Ionicons name={showRenew ? 'close' : 'refresh-outline'} size={18} color={showRenew ? colors.text : colors.onAccent} />}
      />

      {/* ── Apartado de renovación ────────────────────────────── */}
      {showRenew && (
        <Card>
          <Text style={styles.sectionTitle}>1. Elige un plan</Text>
          {loadingPlans ? (
            <LoadingSpinner message="Cargando planes…" />
          ) : planes.length === 0 ? (
            <Text style={styles.emptyText}>No hay planes disponibles en este gimnasio.</Text>
          ) : (
            <>
            {/* Carrusel horizontal: se desliza de izquierda a derecha y se
                detiene centrado en cada plan (snapToInterval). */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={CARD_W + CARD_GAP}
              snapToAlignment="start"
              contentContainerStyle={styles.carruselContent}
              onScroll={(e) => {
                const i = Math.round(e.nativeEvent.contentOffset.x / (CARD_W + CARD_GAP));
                if (i !== indiceActivo) setIndiceActivo(i);
              }}
              scrollEventThrottle={16}
            >
            {planes.map((plan) => {
              const isSel   = selectedPlan?.id_membresia === plan.id_membresia;
              const esPromo = plan.tipo === 'promocion';
              return (
                <TouchableOpacity
                  key={plan.id_membresia}
                  activeOpacity={0.85}
                  style={[
                    styles.planCard,
                    esPromo && styles.planCardPromo,
                    isSel && styles.planCardActive,
                  ]}
                  onPress={() => setSelectedPlan(isSel ? null : plan)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSel }}
                  accessibilityLabel={`${plan.nombre}, $${plan.precio}, ${plan.duracion_meses} meses`}
                >
                  {/* Cinta de promoción, igual que en la web */}
                  {esPromo && (
                    <View style={styles.cintaPromo}>
                      <Text style={styles.cintaPromoText}>PROMOCIÓN</Text>
                    </View>
                  )}

                  {/* Encabezado: selector + nombre */}
                  <View style={styles.planHeader}>
                    <View style={styles.planHeaderLeft}>
                      <View style={[styles.radio, isSel && styles.radioActive]}>
                        {isSel && <View style={styles.radioDot} />}
                      </View>
                      <Text style={styles.planName}>{plan.nombre}</Text>
                    </View>
                  </View>

                  {/* Precio protagonista */}
                  <View style={styles.precioRow}>
                    <Text style={[styles.planPrice, esPromo && { color: colors.promo }]}>
                      ${plan.precio}
                    </Text>
                    <Text style={styles.precioMoneda}>MXN</Text>
                  </View>

                  {/* Duración como chip */}
                  <View style={styles.chipDuracion}>
                    <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
                    <Text style={styles.chipDuracionText}>
                      {plan.duracion_meses} {plan.duracion_meses === 1 ? 'mes' : 'meses'}
                      {plan.duracion_meses > 1 &&
                        ` · $${Math.round(plan.precio / plan.duracion_meses)}/mes`}
                    </Text>
                  </View>

                  {/* Etiquetas: ahorro y vigencia de la promoción */}
                  <View style={styles.planTags}>
                    {!!plan.ahorro && plan.ahorro > 0 && (
                      <View style={styles.tagSave}>
                        <Text style={styles.tagSaveText}>Ahorras ${plan.ahorro.toFixed(0)}</Text>
                      </View>
                    )}
                    {esPromo && (
                      <View style={styles.tagPromo}>
                        <Ionicons name="flame" size={11} color={colors.promo} />
                        <Text style={styles.tagPromoText}>
                          {plan.dias_restantes_promo == null
                            ? 'Promoción'
                            : plan.dias_restantes_promo === 0
                              ? 'Último día'
                              : `Solo ${plan.dias_restantes_promo} día${plan.dias_restantes_promo === 1 ? '' : 's'}`}
                        </Text>
                      </View>
                    )}
                  </View>

                  {!!plan.descripcion && (
                    <Text style={styles.planDesc}>{plan.descripcion}</Text>
                  )}

                  {/* Beneficios definidos por el gimnasio */}
                  {Array.isArray(plan.beneficios) && plan.beneficios.length > 0 && (
                    <View style={styles.beneficios}>
                      {plan.beneficios.map((b, i) => (
                        <View key={i} style={styles.beneficioRow}>
                          <Ionicons name="checkmark-circle" size={14} color={colors.dataProgreso} />
                          <Text style={styles.beneficioText}>{b}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Qué incluye el combo */}
                  {plan.es_combo && !!plan.items_combo?.length && (
                    <View style={styles.comboBox}>
                      <Text style={styles.comboTitle}>COMBO INCLUYE</Text>
                      {plan.items_combo.map((it, i) => (
                        <Text key={i} style={styles.comboItem}>
                          {it.cantidad}× {it.nombre}
                        </Text>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            </ScrollView>

            {/* Indicadores de posición del carrusel */}
            {planes.length > 1 && (
              <View style={styles.dots}>
                {planes.map((p, i) => (
                  <View
                    key={p.id_membresia}
                    style={[styles.dot, i === indiceActivo && styles.dotActivo]}
                  />
                ))}
              </View>
            )}
            </>
          )}

          {selectedPlan && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 18 }]}>2. Método de pago</Text>
              {/* Efectivo + las pasarelas que el gimnasio tenga activas */}
              <View style={styles.metodosRow}>
                {metodosPago.map((m) => {
                  const active = metodo === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.metodoChip, active && styles.metodoChipActive]}
                      onPress={() => setMetodo(m.id as MetodoPago)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      accessibilityLabel={m.label}
                    >
                      <Ionicons
                        name={m.id === 'Efectivo' ? 'cash-outline' : 'card-outline'}
                        size={16}
                        color={active ? colors.onAccent : colors.textSecondary}
                      />
                      <Text style={[styles.metodoText, active && { color: colors.onAccent }]}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {!conectado ? (
                // SCRUM-168 / HU-30: sin conexión se bloquea TODO el flujo de
                // renovación, no solo las pasarelas — ver doRenew más arriba.
                <View style={styles.warnRow}>
                  <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
                  <Text style={styles.warnText}>
                    Sin conexión: no se puede renovar ni pagar en este momento, ni en
                    efectivo ni con pasarela. Intenta de nuevo cuando recuperes internet.
                  </Text>
                </View>
              ) : pagosSinConexion && (
                <View style={styles.warnRow}>
                  <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
                  <Text style={styles.warnText}>
                    Pago con PayPal o Mercado Pago no disponible sin conexión. Solo puedes
                    renovar en efectivo hasta recuperar internet.
                  </Text>
                </View>
              )}

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total a pagar</Text>
                <Text style={styles.totalValue}>${selectedPlan.precio}</Text>
              </View>

              <Button
                label={
                  metodosPago.find((m) => m.id === metodo)?.esPasarela
                    ? `Pagar con ${metodosPago.find((m) => m.id === metodo)?.label}`
                    : `Renovar con ${selectedPlan.nombre}`
                }
                onPress={confirmRenew}
                loading={renewing || pagando}
                disabled={!conectado}
                style={{ marginTop: 12 }}
              />
            </>
          )}
        </Card>
      )}

      {/* ── Resumen financiero ─────────────────────────────────── */}
      {statsPagos && (
        <>
          <Text style={styles.sectionTitleBloque}>Resumen financiero</Text>
          <View style={styles.grid2x2}>
            <Card style={styles.miniCard} padding={14}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.dataProgreso} />
              <Text style={styles.miniLabel}>Último pago</Text>
              <Text style={styles.miniValue}>{statsPagos.lastPayment}</Text>
            </Card>
            <Card style={styles.miniCard} padding={14}>
              <Ionicons name="calendar-outline" size={18} color={colors.dataAtencion} />
              <Text style={styles.miniLabel}>Próximo pago</Text>
              <Text style={styles.miniValue}>{statsPagos.nextPayment}</Text>
            </Card>
            <Card style={styles.miniCard} padding={14}>
              <Ionicons
                name={statsPagos.status === 'Al día' ? 'shield-checkmark-outline' : 'alert-circle-outline'}
                size={18}
                color={statsPagos.status === 'Al día' ? colors.success : colors.warning}
              />
              <Text style={styles.miniLabel}>Estado</Text>
              <Badge
                label={statsPagos.status}
                color={statsPagos.status === 'Al día' ? 'success' : 'warning'}
                style={{ marginTop: 4 }}
              />
            </Card>
            <Card style={styles.miniCard} padding={14}>
              <Ionicons name="wallet-outline" size={18} color={colors.accent} />
              <Text style={styles.miniLabel}>Total invertido</Text>
              <Text style={styles.miniValue}>${statsPagos.totalPaid.toLocaleString('es-MX')}</Text>
              {(statsPagos.totalCompras ?? 0) > 0 && (
                <View style={styles.desglose}>
                  <View style={styles.desgloseItem}>
                    <View style={[styles.desglosePunto, { backgroundColor: colors.dataProgreso }]} />
                    <Text style={styles.desgloseText}>
                      Membresías ${Number(statsPagos.totalMembresias ?? 0).toLocaleString('es-MX')}
                    </Text>
                  </View>
                  <View style={styles.desgloseItem}>
                    <View style={[styles.desglosePunto, { backgroundColor: colors.dataActividad }]} />
                    <Text style={styles.desgloseText}>
                      Compras ${Number(statsPagos.totalCompras ?? 0).toLocaleString('es-MX')}
                    </Text>
                  </View>
                </View>
              )}
            </Card>
          </View>
        </>
      )}

      {/* ── Historial de transacciones ─────────────────────────── */}
      {loadingPagos ? (
        <LoadingSpinner message="Cargando historial de pagos…" />
      ) : (
        <Card>
          <Text style={styles.sectionTitle}>Historial de transacciones</Text>

          {/* El filtro solo aparece si hay algo que separar */}
          {hayComprasPOS && (
            <View style={styles.filtros}>
              {([
                { id: 'todos',      etiqueta: 'Todo'        },
                { id: 'membresia',  etiqueta: 'Membresías'  },
                { id: 'producto',   etiqueta: 'Compras'     },
              ] as { id: FiltroPagos; etiqueta: string }[]).map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.filtroChip, filtroPagos === f.id && styles.filtroActivo]}
                  onPress={() => setFiltroPagos(f.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: filtroPagos === f.id }}
                  accessibilityLabel={`Ver ${f.etiqueta}`}
                >
                  <Text style={[styles.filtroText, filtroPagos === f.id && styles.filtroTextActivo]}>
                    {f.etiqueta}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {pagosFiltrados.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                {filtroPagos === 'producto'  ? 'Aún no has comprado nada en el gimnasio.'
                 : filtroPagos === 'membresia' ? 'Aún no tienes pagos de membresía.'
                 : 'Aún no tienes pagos registrados.'}
              </Text>
            </View>
          ) : (
            pagosFiltrados.map((p) => {
              const esCompra = p.type === 'producto';
              return (
                <View key={p.id} style={styles.payRow}>
                  <View style={[
                    styles.payIcon,
                    { backgroundColor: esCompra ? colors.dataActividadBg : colors.dataProgresoBg },
                  ]}>
                    <Ionicons
                      name={methodIcon(p.method)}
                      size={18}
                      color={esCompra ? colors.dataActividad : colors.dataProgreso}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.conceptoRow}>
                      <Text style={styles.payConcept} numberOfLines={1}>{p.concept}</Text>
                      <View style={[
                        styles.tipoPill,
                        { backgroundColor: esCompra ? colors.dataActividadBg : colors.dataProgresoBg },
                      ]}>
                        <Text style={[
                          styles.tipoText,
                          { color: esCompra ? colors.dataActividad : colors.dataProgreso },
                        ]}>
                          {esCompra ? 'Compra' : 'Membresía'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.payMeta}>
                      {p.date}  ·  {p.method}
                      {esCompra && p.items ? `  ·  ${p.items} art.` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.payAmount}>${p.amount.toLocaleString('es-MX')}</Text>
                    <Badge
                      label={p.status}
                      color={p.status === 'Completado' ? 'success' : 'warning'}
                      style={styles.payStatusBadge}
                    />
                  </View>
                </View>
              );
            })
          )}
        </Card>
      )}

      <View style={styles.infoRow}>
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.success} />
        <Text style={styles.infoText}>Tus datos de membresía están protegidos y cifrados.</Text>
      </View>
    </ScrollView>
  );
}

function make_styles(colors: ReturnType<typeof useColors>, fs = 1) {
  return StyleSheet.create({
    screen:  { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, gap: 16, paddingBottom: 32 },
    title:   { color: colors.text, fontSize: 26 * fs, fontWeight: '700' },

    // ── Pase de membresía ────────────────────────────────────────────────
    pase:      { borderLeftWidth: 4, borderLeftColor: colors.accent },
    paseTag:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
    paseTagText: { color: colors.accent, fontSize: 10 * fs, fontWeight: '800', letterSpacing: 0.6 },
    memHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    memName:   { color: colors.text, fontSize: 18 * fs, fontWeight: '700' },
    memPrice:  { color: colors.accent, fontSize: 16 * fs, fontWeight: '700', marginTop: 2 },
    memPriceUnit: { color: colors.textSecondary, fontSize: 12 * fs, fontWeight: '500' },
    daysBox:   { alignItems: 'center', paddingVertical: 16 },
    daysNum:   { color: colors.text, fontSize: 44 * fs, fontWeight: '800', lineHeight: 48 * fs },
    daysLabel: { color: colors.textSecondary, fontSize: 13 * fs },
    perforacion: {
      borderTopWidth: 1.5, borderTopColor: colors.border, borderStyle: 'dashed',
      marginBottom: 12,
    },
    datesRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dateCol:   { flex: 1 },
    dateLabel: { color: colors.textSecondary, fontSize: 11 * fs },
    dateValue: { color: colors.text, fontSize: 14 * fs, fontWeight: '600', marginTop: 2 },
    warnRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
                 backgroundColor: colors.warningBg, padding: 10, borderRadius: 10 },
    warnText:  { color: colors.warning, fontSize: 12 * fs, flex: 1 },

    noMem:    { alignItems: 'center', paddingVertical: 24, gap: 8 },
    noMemText:{ color: colors.text, fontSize: 16 * fs, fontWeight: '600' },
    noMemSub: { color: colors.textSecondary, fontSize: 13 * fs, textAlign: 'center' },

    sectionTitle:       { color: colors.text, fontSize: 15 * fs, fontWeight: '700', marginBottom: 12 },
    sectionTitleBloque: { color: colors.text, fontSize: 15 * fs, fontWeight: '700' },
    emptyText:    { color: colors.textMuted, fontSize: 13 * fs },

    // ── Carrusel de planes ───────────────────────────────────────────────
    carruselContent: { paddingVertical: 4, paddingRight: 4 },
    dots:     { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
    dot:      { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
    dotActivo:{ backgroundColor: colors.accent, width: 18 },

    // ── Tarjetas de plan ─────────────────────────────────────────────────
    planCard: {
      width: CARD_W, marginRight: CARD_GAP,
      borderWidth: 1, borderColor: colors.border, borderRadius: 14,
      padding: 14, backgroundColor: colors.inputBg,
    },
    planCardActive: {
      borderColor: colors.accent, borderWidth: 2,
      backgroundColor: colors.accent + '12',
    },
    // Las promociones se destacan con un halo del color comercial de la paleta
    planCardPromo: {
      borderColor: colors.promo,
      shadowColor: colors.promo, shadowOpacity: 0.35, shadowRadius: 10,
      shadowOffset: { width: 0, height: 0 }, elevation: 6,
    },
    planHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    planHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },

    // Cinta superior de las promociones
    cintaPromo: {
      position: 'absolute', top: 0, alignSelf: 'center',
      backgroundColor: colors.promo, paddingHorizontal: 12, paddingVertical: 3,
      borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
    },
    cintaPromoText: { color: colors.background, fontSize: 9.5 * fs, fontWeight: '800', letterSpacing: 0.6 },

    precioRow:    { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 10 },
    precioMoneda: { color: colors.textSecondary, fontSize: 12 * fs, fontWeight: '600' },

    chipDuracion: {
      flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
      backgroundColor: colors.card, borderRadius: 8,
      paddingHorizontal: 9, paddingVertical: 5, marginTop: 8,
    },
    chipDuracionText: { color: colors.textSecondary, fontSize: 11.5 * fs, fontWeight: '600' },

    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border,
             alignItems: 'center', justifyContent: 'center' },
    radioActive: { borderColor: colors.accent },
    radioDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },

    planName:     { color: colors.text, fontSize: 16 * fs, fontWeight: '700' },
    planDuration: { color: colors.textSecondary, fontSize: 12 * fs, marginTop: 2 },
    planPrice:    { color: colors.accent, fontSize: 22 * fs, fontWeight: '800' },
    planDesc:     { color: colors.textSecondary, fontSize: 12.5 * fs, lineHeight: 18 * fs, marginTop: 10 },

    planTags:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    // Ahorro = el usuario gana -> tono progreso.  Promoción -> tono comercial.
    tagSave:      { backgroundColor: colors.dataProgresoBg, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
    tagSaveText:  { color: colors.dataProgreso, fontSize: 11 * fs, fontWeight: '700' },
    tagPromo:     { flexDirection: 'row', alignItems: 'center', gap: 4,
                    backgroundColor: colors.promoBg, borderRadius: 7,
                    paddingHorizontal: 8, paddingVertical: 3 },
    tagPromoText: { color: colors.promo, fontSize: 11 * fs, fontWeight: '700' },

    beneficios:    { marginTop: 12, gap: 6 },
    beneficioRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    beneficioText: { color: colors.text, fontSize: 12.5 * fs, lineHeight: 17 * fs, flex: 1 },

    comboBox:   { marginTop: 12, backgroundColor: colors.card, borderRadius: 10, padding: 10 },
    comboTitle: { color: colors.accent, fontSize: 10 * fs, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
    comboItem:  { color: colors.textSecondary, fontSize: 12 * fs, lineHeight: 18 * fs },

    metodosRow:  { flexDirection: 'row', gap: 8 },
    metodoChip:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                   paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
                   backgroundColor: colors.inputBg },
    metodoChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    metodoText:  { color: colors.textSecondary, fontSize: 12 * fs, fontWeight: '600' },
    totalRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
    totalLabel:  { color: colors.textSecondary, fontSize: 14 * fs },
    totalValue:  { color: colors.text, fontSize: 22 * fs, fontWeight: '800' },

    // ── Resumen financiero (grid 2x2) ────────────────────────────────────
    grid2x2:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    miniCard:  { flexBasis: '47%', flexGrow: 1, gap: 4 },
    miniLabel: { color: colors.textSecondary, fontSize: 11 * fs, marginTop: 4 },
    miniValue: { color: colors.text, fontSize: 14 * fs, fontWeight: '700' },

    desglose:      { flexDirection: 'column', gap: 4, marginTop: 8 },
    desgloseItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
    desglosePunto: { width: 7, height: 7, borderRadius: 4 },
    desgloseText:  { color: colors.textSecondary, fontSize: 11 * fs },

    // ── Historial de transacciones ───────────────────────────────────────
    filtros:    { flexDirection: 'row', gap: 8, marginBottom: 14 },
    filtroChip: {
      paddingHorizontal: 13, paddingVertical: 6, borderRadius: 20,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    filtroActivo:     { backgroundColor: colors.accentBg, borderColor: colors.accent },
    filtroText:       { color: colors.textSecondary, fontSize: 12.5 * fs, fontWeight: '600' },
    filtroTextActivo: { color: colors.accent, fontWeight: '700' },

    conceptoRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    tipoPill:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
    tipoText:    { fontSize: 10 * fs, fontWeight: '700' },

    empty:     { alignItems: 'center', paddingVertical: 24, gap: 10 },

    payRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
              borderBottomWidth: 1, borderBottomColor: colors.border },
    // El fondo del icono lo pone el tipo de pago (membresía o compra).
    payIcon: { width: 38, height: 38, borderRadius: 12,
               alignItems: 'center', justifyContent: 'center' },
    payConcept: { color: colors.text, fontSize: 14 * fs, fontWeight: '600', flexShrink: 1 },
    payMeta:    { color: colors.textSecondary, fontSize: 12 * fs, marginTop: 2 },
    payAmount:  { color: colors.text, fontSize: 15 * fs, fontWeight: '700' },
    payStatusBadge: { marginTop: 4 },

    infoRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
    infoText: { color: colors.textMuted, fontSize: 12 * fs },
  });
}
