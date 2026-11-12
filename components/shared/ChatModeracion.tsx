/**
 * ChatModeracion.tsx — bloqueo y denuncia de usuarios en el chat (HU-12).
 *
 * Compartido entre la pantalla de chat de Miembro (app/(member)/chat.tsx)
 * y de Entrenador (app/(trainer)/chat.tsx): el backend ya trata ambos
 * lados con el mismo contrato (ver app/routes/compartido/chat_moderacion.py
 * en gympro-api -- "no hay una versión de miembro y otra de entrenador de
 * estas reglas"), así que un solo componente cubre los dos casos en vez
 * de reimplementar el mismo flujo dos veces.
 *
 * El padre (cada pantalla de chat) es responsable de:
 *   - Traer "¿ya bloqueé a esta persona?" con useFetch(ENDPOINTS.CHAT_BLOQUEOS)
 *     -- igual que el resto de la pantalla trae sus propios datos -- y
 *     pasarlo en la prop `bloqueado`.
 *   - Refrescar esa lista (y el chat) cuando `onCambio` se dispare, para
 *     que el input/banner de "conversación bloqueada" reaccione al toque.
 *
 * API:
 *   GET    /api/chat/bloqueos               -> mis bloqueos activos
 *   POST   /api/chat/bloqueos               -> bloquear { id_usuario_bloqueado }
 *   DELETE /api/chat/bloqueos/<id_usuario>  -> desbloquear
 *   POST   /api/chat/reportes               -> { id_usuario_reportado, motivo, comentario? }
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Modal, TextInput, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, useFontScale } from '../../hooks/useColors';
import { ENDPOINTS } from '../../constants/Api';
import api from '../../services/api';
import * as Haptics from 'expo-haptics';

// Mismo catálogo cerrado que valida el backend (MOTIVOS_REPORTE_CHAT en
// app/models/pg/reporte_chat.py) -- si ese catálogo cambia, actualizar
// aquí también.
const MOTIVOS: { value: string; label: string }[] = [
  { value: 'acoso',                label: 'Acoso' },
  { value: 'lenguaje_inapropiado', label: 'Lenguaje inapropiado' },
  { value: 'spam_publicidad',      label: 'Spam o publicidad' },
  { value: 'suplantacion',         label: 'Suplantación de identidad' },
  { value: 'contenido_inapropiado',label: 'Contenido inapropiado' },
  { value: 'otro',                 label: 'Otro' },
];

export interface BloqueoItem {
  id:                   number;
  id_usuario_bloqueado: number;
  nombre_bloqueado:     string | null;
  creado_en:            string | null;
}

interface Props {
  contraparteId:     number | null | undefined;
  contraparteNombre: string;
  bloqueado:         boolean;
  /** Se llama tras bloquear, desbloquear o reportar con éxito, para que
   *  el padre refresque su lista de bloqueos (y el chat, si aplica). */
  onCambio:          () => void;
}

export default function ChatModeracion({ contraparteId, contraparteNombre, bloqueado, onCambio }: Props) {
  const colors = useColors();
  const fs     = useFontScale();
  const styles = useMemo(() => make_styles(colors, fs), [colors, fs]);

  const [reportando, setReportando] = useState(false);
  const [motivo,     setMotivo]     = useState<string | null>(null);
  const [comentario, setComentario] = useState('');
  const [enviando,   setEnviando]   = useState(false);

  if (!contraparteId) return null;

  const cerrarModalReporte = () => {
    setReportando(false);
    setMotivo(null);
    setComentario('');
  };

  const ejecutarBloqueo = () => {
    api.post(ENDPOINTS.CHAT_BLOQUEOS, { id_usuario_bloqueado: contraparteId })
      .then(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onCambio();
      })
      .catch((e: any) => {
        Alert.alert('No se pudo bloquear', e?.response?.data?.msg ?? 'Intenta de nuevo más tarde.');
      });
  };

  const ejecutarDesbloqueo = () => {
    api.delete(`${ENDPOINTS.CHAT_BLOQUEOS}/${contraparteId}`)
      .then(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onCambio();
      })
      .catch((e: any) => {
        Alert.alert('No se pudo desbloquear', e?.response?.data?.msg ?? 'Intenta de nuevo más tarde.');
      });
  };

  const confirmarBloqueo = () => {
    Alert.alert(
      `¿Bloquear a ${contraparteNombre}?`,
      'No podrán enviarse mensajes entre ustedes hasta que lo desbloquees.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Bloquear', style: 'destructive', onPress: ejecutarBloqueo },
      ],
    );
  };

  const abrirMenu = () => {
    Alert.alert(
      contraparteNombre,
      undefined,
      [
        bloqueado
          ? { text: 'Desbloquear', onPress: ejecutarDesbloqueo }
          : { text: 'Bloquear', style: 'destructive', onPress: confirmarBloqueo },
        { text: 'Reportar', onPress: () => setReportando(true) },
        { text: 'Cancelar', style: 'cancel' },
      ],
    );
  };

  const enviarReporte = () => {
    if (!motivo) {
      Alert.alert('Falta el motivo', 'Elige por qué estás reportando a esta persona.');
      return;
    }
    setEnviando(true);
    api.post(ENDPOINTS.CHAT_REPORTES, {
      id_usuario_reportado: contraparteId,
      motivo,
      comentario: comentario.trim() || undefined,
    })
      .then(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        cerrarModalReporte();
        Alert.alert('Reporte enviado', 'El propietario del gimnasio lo revisará.');
        onCambio();
      })
      .catch((e: any) => {
        Alert.alert('No se pudo enviar', e?.response?.data?.msg ?? 'Intenta de nuevo más tarde.');
      })
      .finally(() => setEnviando(false));
  };

  return (
    <>
      <TouchableOpacity
        onPress={abrirMenu}
        style={styles.boton}
        accessibilityRole="button"
        accessibilityLabel={`Opciones de moderación para ${contraparteNombre}`}
      >
        <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal visible={reportando} transparent animationType="fade" onRequestClose={cerrarModalReporte}>
        <View style={styles.overlay}>
          <View style={styles.hoja}>
            <Text style={styles.hojaTitulo}>Reportar a {contraparteNombre}</Text>
            <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
              {MOTIVOS.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  style={styles.motivoRow}
                  onPress={() => setMotivo(m.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: motivo === m.value }}
                >
                  <Ionicons
                    name={motivo === m.value ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={motivo === m.value ? colors.accent : colors.textMuted}
                  />
                  <Text style={styles.motivoText}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput
              style={styles.comentarioInput}
              placeholder="Agrega más detalle (opcional)"
              placeholderTextColor={colors.textMuted}
              value={comentario}
              onChangeText={setComentario}
              multiline
              maxLength={500}
              accessibilityLabel="Comentario del reporte"
            />
            <View style={styles.hojaBotones}>
              <TouchableOpacity style={styles.hojaBotonSecundario} onPress={cerrarModalReporte}>
                <Text style={styles.hojaBotonSecundarioText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.hojaBotonPrincipal, enviando && { opacity: 0.6 }]}
                onPress={enviarReporte}
                disabled={enviando}
                accessibilityRole="button"
              >
                <Text style={styles.hojaBotonPrincipalText}>{enviando ? 'Enviando…' : 'Enviar reporte'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function make_styles(colors: ReturnType<typeof useColors>, fs = 1) {
  return StyleSheet.create({
    boton:   { padding: 6 },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    hoja:    { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 14 },
    hojaTitulo: { color: colors.text, fontSize: 17 * fs, fontWeight: '700' },
    motivoRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
    motivoText: { color: colors.text, fontSize: 14 * fs },
    comentarioInput: {
      backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
      padding: 10, color: colors.text, fontSize: 13 * fs, minHeight: 60, textAlignVertical: 'top',
    },
    hojaBotones: { flexDirection: 'row', gap: 10 },
    hojaBotonSecundario: {
      flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center',
    },
    hojaBotonSecundarioText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 * fs },
    hojaBotonPrincipal: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center' },
    hojaBotonPrincipalText: { color: colors.onAccent, fontWeight: '700', fontSize: 14 * fs },
  });
}
