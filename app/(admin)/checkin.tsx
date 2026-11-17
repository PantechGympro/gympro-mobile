/**
 * Registrar entrada (Propietario/Administrador).
 * GET  /api/checkins/manual/buscar?q=  → { miembros: [{ id, nombre, estado, tipo_membresia, fecha_fin_local, id_usuario_pg }] }
 * POST /api/checkins/manual { id_miembro } → 201 | 403 (membresía vencida/sin membresía) | 409 (ya entró hoy)
 * La pantalla avisa el estado antes de registrar, pero la regla real vive en el backend.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, useFontScale } from '../../hooks/useColors';
import { ENDPOINTS } from '../../constants/Api';
import api from '../../services/api';
import { mensajeAmigable } from '../../utils/errores';
import Card from '../../components/ui/Card';
import AvatarFoto from '../../components/ui/AvatarFoto';

interface Resultado {
  id: string; id_usuario_pg?: number; nombre: string; foto_perfil?: string | null;
  estado: 'activa' | 'por_vencer' | 'vencida' | 'sin_membresia';
  tipo_membresia?: string | null; fecha_fin_local?: string | null;
}

export default function CheckinManualScreen() {
  const colors = useColors();
  const fs = useFontScale();
  const styles = useMemo(() => make_styles(colors, fs), [colors, fs]);
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [registrando, setRegistrando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const ultima = useRef(0);

  // Espera 350 ms al teclear y descarta respuestas viejas (evita parpadeos).
  useEffect(() => {
    if (q.trim().length < 2) { setResultados([]); return; }
    const id = ++ultima.current;
    const t = setTimeout(() => {
      setBuscando(true);
      api.get(ENDPOINTS.CHECKIN_MANUAL_BUSCAR, { params: { q: q.trim() } })
        .then((r) => { if (id === ultima.current) setResultados(r.data?.miembros ?? []); })
        .catch((e) => { if (id === ultima.current) setAviso({ ok: false, texto: mensajeAmigable(e, 'No pudimos buscar miembros.') }); })
        .finally(() => { if (id === ultima.current) setBuscando(false); });
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const registrar = (m: Resultado) => {
    Keyboard.dismiss();
    setRegistrando(m.id);
    setAviso(null);
    api.post(ENDPOINTS.CHECKIN_MANUAL, { id_miembro: m.id })
      .then((r) => { setAviso({ ok: true, texto: `${r.data?.message ?? 'Entrada registrada.'} (${r.data?.hora ?? ''})` }); setQ(''); setResultados([]); })
      .catch((e) => setAviso({ ok: false, texto: mensajeAmigable(e, 'No pudimos registrar la entrada.') }))
      .finally(() => setRegistrando(null));
  };

  const etiqueta = (m: Resultado) =>
    m.estado === 'sin_membresia' ? 'Sin membresía activa'
      : m.estado === 'vencida' ? `Membresía vencida${m.fecha_fin_local ? ` el ${m.fecha_fin_local}` : ''}`
      : `Vigente${m.fecha_fin_local ? ` hasta ${m.fecha_fin_local}` : ''}`;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title} accessibilityRole="header">Registrar entrada</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput style={styles.searchInput} value={q} onChangeText={setQ} autoCorrect={false}
            placeholder="Nombre, correo, teléfono o número de socio" placeholderTextColor={colors.textMuted}
            accessibilityLabel="Buscar miembro" />
        </View>
        {aviso ? (
          <View style={[styles.aviso, { backgroundColor: aviso.ok ? colors.successBg : colors.errorBg }]}
            accessibilityRole={aviso.ok ? 'text' : 'alert'}>
            <Ionicons name={aviso.ok ? 'checkmark-circle' : 'alert-circle'} size={20} color={aviso.ok ? colors.success : colors.error} />
            <Text style={[styles.avisoTxt, { color: aviso.ok ? colors.success : colors.error }]}>{aviso.texto}</Text>
          </View>
        ) : null}
      </View>

      <FlatList
        data={resultados}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <Text style={styles.vacio}>
            {buscando ? 'Buscando…' : q.trim().length >= 2 ? 'No encontramos a nadie con ese dato. Revisa la escritura o prueba con el número de socio.' : 'Escribe al menos 2 letras para buscar.'}
          </Text>
        }
        renderItem={({ item: m }) => {
          const puede = m.estado === 'activa' || m.estado === 'por_vencer';
          return (
            <Card style={{ marginBottom: 10 }}>
              <View style={styles.row}>
                <AvatarFoto foto={m.foto_perfil} nombre={m.nombre} size={44} borderRadius={14} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{m.nombre}</Text>
                  <Text style={[styles.estado, { color: puede ? colors.success : colors.error }]}>{etiqueta(m)}</Text>
                </View>
              </View>
              {!puede ? <Text style={styles.ayuda}>Para registrar su entrada primero debe renovar o contratar un plan.</Text> : null}
              <TouchableOpacity disabled={!puede || registrando === m.id} onPress={() => registrar(m)}
                accessibilityRole="button" accessibilityLabel={`Registrar entrada de ${m.nombre}`}
                style={[styles.boton, { backgroundColor: puede ? colors.accent : colors.border }]}>
                <Ionicons name="log-in-outline" size={20} color={colors.onAccent} />
                <Text style={[styles.botonTxt, { color: colors.onAccent }]}>{registrando === m.id ? 'Registrando…' : 'Registrar entrada'}</Text>
              </TouchableOpacity>
            </Card>
          );
        }}
      />
    </View>
  );
}

function make_styles(colors: ReturnType<typeof useColors>, fs = 1) {
  return StyleSheet.create({
    screen:  { flex: 1, backgroundColor: colors.background },
    header:  { paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
    title:   { color: colors.text, fontSize: 26 * fs, fontWeight: '700' },
    searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.inputBg, borderRadius: 12,
                 borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 },
    searchInput: { flex: 1, color: colors.text, paddingVertical: 14, fontSize: 16 * fs },
    aviso:   { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, alignItems: 'flex-start' },
    avisoTxt:{ flex: 1, fontSize: 14 * fs },
    content: { paddingHorizontal: 20, paddingBottom: 32 },
    vacio:   { color: colors.textMuted, textAlign: 'center', paddingVertical: 32, fontSize: 14 * fs },
    row:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
    name:    { color: colors.text, fontSize: 16 * fs, fontWeight: '700' },
    estado:  { fontSize: 13 * fs, fontWeight: '600', marginTop: 2 },
    ayuda:   { color: colors.textSecondary, fontSize: 13 * fs, marginTop: 8 },
    boton:   { minHeight: 48, borderRadius: 12, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    botonTxt:{ fontWeight: '700', fontSize: 15 * fs },
  });
}
