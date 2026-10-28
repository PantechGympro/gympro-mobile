/**
 * CustomDrawer — Sidebar izquierda compartida para todos los roles.
 * Incluye botón de accesibilidad (⚙) que abre AccessibilityPanel.
 * Reacciona al tema activo vía useColors().
 *
 * Rediseño de navegación global (ver ../../app/(member)/_layout.tsx para el
 * resto del contexto): el cajón dejó de llevar Inicio/Entrenamiento/
 * Nutrición/Perfil (ahora en la Bottom Tab Bar) y los acordeones
 * desplegables de Membresía/Progreso se fusionaron en ítems directos. Lo
 * que queda aquí es: la lista dinámica de Drawer.Screen no ocultas (para
 * el rol Miembro: Membresía, Progreso y Salud, Punto de Venta — los demás
 * roles siguen viendo la suya propia, sin cambios) más un bloque fijo de
 * opciones de app (Ajustes, Notificaciones, Accesibilidad, Soporte) que no
 * son Drawer.Screen porque sus pantallas no viven dentro de este grupo de
 * rutas, o no son ni siquiera una pantalla (Accesibilidad es un modal
 * local).
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
/**
 * Contrato del contenido del cajón.
 *
 * No se reutiliza DrawerContentComponentProps de @react-navigation/drawer
 * porque expo-router reexporta el Drawer con SUS PROPIOS tipos: mismos objetos
 * en ejecución, pero declaraciones distintas. Las dos difieren, entre otras
 * cosas, en si `tintColor` es `string` o `ColorValue`, y TypeScript rechaza el
 * paso de props aunque el código funcione.
 *
 * Se declara aquí lo único que este componente consume. Es un contrato más
 * pequeño y más honesto: si algún día deja de recibirse, el error saldrá aquí
 * y no enterrado en veinte niveles de tipos genéricos.
 */
interface PropsCajon {
  state: {
    routes: { key: string; name: string }[];
    index:  number;
  };
  /** Se consume solo navigate(); el objeto real trae decenas de métodos
   *  con firmas sobrecargadas que no aportan nada aquí. */
  navigation: any;
  descriptors: Record<string, { options: any }>;
}
import { useColors, useFontScale } from '../../hooks/useColors';
import { useAuth } from '../../hooks/useAuth';
import { toStr } from '../../utils/format';
import AccessibilityPanel from '../settings/AccessibilityPanel';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Bloque fijo de opciones de app -- igual para todos los roles, siempre al
 * final de la lista dinámica. No son Drawer.Screen: Ajustes y Soporte son
 * rutas compartidas fuera de cualquier grupo de rol (ver app/ajustes.tsx y
 * app/soporte.tsx), Notificaciones vive en app/notifications.tsx (ya
 * existía como ícono del header; ahora también aparece aquí), y
 * Accesibilidad no navega a ningún lado: abre el modal local más abajo.
 */
interface OpcionApp { id: string; label: string; icon: IconName }
const OPCIONES_APP: OpcionApp[] = [
  { id: 'ajustes',       label: 'Ajustes',       icon: 'settings-outline' },
  { id: 'notificaciones', label: 'Notificaciones', icon: 'notifications-outline' },
  { id: 'accesibilidad', label: 'Accesibilidad', icon: 'accessibility-outline' },
  { id: 'soporte',       label: 'Soporte',       icon: 'help-buoy-outline' },
];

function getRoleLabel(role?: string): string {
  switch (role) {
    case 'owner_gym':  return 'Propietario';
    case 'Admin':      return 'Administrador';
    case 'superadmin': return 'Super Admin';
    case 'Entrenador': return 'Entrenador';
    case 'Recepcionista':
    case 'recepcionista': return 'Recepcionista';
    case 'Miembro':
    case 'user':       return 'Miembro';
    default:           return 'Usuario';
  }
}

export default function CustomDrawer(props: PropsCajon) {
  const { state, navigation, descriptors } = props;
  const insets  = useSafeAreaInsets();
  const colors  = useColors();
  const fs      = useFontScale();
  const { user, logout } = useAuth();

  const [showA11y, setShowA11y] = useState(false);

  const nombre    = toStr(user?.nombre, 'Usuario');
  const initials  = nombre.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  const roleLabel = getRoleLabel(user?.role);

  const irAOpcionApp = (id: string) => {
    if (id === 'accesibilidad') { setShowA11y(true); return; }
    if (id === 'ajustes')       { router.push('/ajustes');       return; }
    if (id === 'notificaciones') { router.push('/notifications'); return; }
    if (id === 'soporte')       { router.push('/soporte');       return; }
  };

  return (
    <>
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>

        {/* ── Cabecera ──────────────────────────────────────────────────── */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          {user?.foto_perfil && user.foto_perfil.startsWith('data:image') ? (
            <Image source={{ uri: user.foto_perfil }}
                   style={[styles.avatarImg, { backgroundColor: colors.surface, borderColor: colors.accent }]}
                   resizeMode="cover" />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.accent, borderColor: colors.accent }]}>
              <Text style={[styles.initials, { color: colors.onAccent }]}>{initials}</Text>
            </View>
          )}
          <Text style={[styles.name, { color: colors.text, fontSize: 17 * fs }]} numberOfLines={1}>{nombre}</Text>
          <View style={[styles.rolePill, { backgroundColor: colors.accent + '22' }]}>
            <Text style={[styles.roleText, { color: colors.accent, fontSize: 11 * fs }]}>{roleLabel}</Text>
          </View>
        </View>

        {/* ── Ítems de navegación ───────────────────────────────────────── */}
        <ScrollView
          style={styles.navScroll}
          contentContainerStyle={styles.navList}
          showsVerticalScrollIndicator={false}
        >
          {state.routes.map((route: any, i: number) => {
            const { options } = descriptors[route.key];
            const isFocused   = state.index === i;

            // Ocultar ítems con display:none (incluye el contenedor de la
            // Bottom Tab Bar y las rutas internas de cada flujo).
            const itemStyle = options.drawerItemStyle as any;
            if (itemStyle?.display === 'none') return null;

            const rawLabel = options.drawerLabel ?? options.title ?? route.name;
            const label    = typeof rawLabel === 'function'
              ? rawLabel({ focused: isFocused, color: isFocused ? colors.accent : colors.textSecondary })
              : rawLabel;

            const iconEl = options.drawerIcon?.({
              focused: isFocused,
              color:   isFocused ? colors.accent : colors.textSecondary,
              size:    22,
            });

            return (
              <TouchableOpacity
                key={route.key}
                onPress={() => navigation.navigate(route.name)}
                style={[
                  styles.navItem,
                  { borderRadius: 12 },
                  isFocused && { backgroundColor: colors.accent + '18' },
                ]}
                accessibilityRole="button"
                accessibilityLabel={String(label)}
                accessibilityState={{ selected: isFocused }}
              >
                <View style={styles.navIcon}>{iconEl}</View>
                <Text
                  style={[
                    styles.navLabel,
                    { color: isFocused ? colors.accent : colors.textSecondary, fontSize: 14 * fs },
                    isFocused && { fontWeight: '700' },
                  ]}
                  numberOfLines={1}
                >
                  {String(label)}
                </Text>
                {isFocused && (
                  <View style={[styles.activeIndicator, { backgroundColor: colors.accent }]} />
                )}
              </TouchableOpacity>
            );
          })}

          {/* ── Opciones de app (fijas, no son Drawer.Screen) ────────────── */}
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>GENERAL</Text>
          {OPCIONES_APP.map(({ id, label, icon }) => (
            <TouchableOpacity
              key={id}
              onPress={() => irAOpcionApp(id)}
              style={[styles.navItem, { borderRadius: 12 }]}
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <View style={styles.navIcon}>
                <Ionicons name={icon} size={22} color={colors.textSecondary} />
              </View>
              <Text style={[styles.navLabel, { color: colors.textSecondary, fontSize: 14 * fs }]} numberOfLines={1}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 8, borderTopColor: colors.border }]}>
          <TouchableOpacity
            onPress={logout}
            style={styles.logoutBtn}
            accessibilityLabel="Cerrar sesión"
            accessibilityRole="button"
          >
            <View style={[styles.logoutIcon, { backgroundColor: colors.errorBg }]}>
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
            </View>
            <Text style={[styles.logoutText, { color: colors.error, fontSize: 14 * fs }]}>Cerrar sesión</Text>
          </TouchableOpacity>
          <Text style={[styles.version, { color: colors.textMuted }]}>GymPro v1.0.0</Text>
        </View>
      </View>

      {/* Panel de accesibilidad */}
      <AccessibilityPanel visible={showA11y} onClose={() => setShowA11y(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1 },
  // Más padding interno y borde de acento sutil alrededor del avatar
  // (pedido explícito del rediseño); se quitaron los dos botones de acción
  // (notificaciones/accesibilidad) que vivían aquí -- ahora son filas del
  // menú (OPCIONES_APP), así que la cabecera ya no necesita repartir el
  // espacio con ellos y el avatar respira más.
  header:    { paddingHorizontal: 20, paddingVertical: 22, alignItems: 'center', gap: 6, borderBottomWidth: 1 },
  avatar:    { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  avatarImg: { width: 72, height: 72, borderRadius: 24, borderWidth: 2 },
  initials:  { fontSize: 26, fontWeight: '800' },   // color: colors.onAccent en línea
  name:      { fontWeight: '700', marginTop: 4 },
  // `email` se quitó: ya se muestra con más detalle en Mi Perfil, repetirlo
  // aquí era ruido (pedido explícito del rediseño).
  rolePill:  { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginTop: 2 },
  roleText:  { fontWeight: '600' },
  navScroll: { flex: 1 },
  navList:   { paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  navItem:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 14, position: 'relative' },
  navIcon:   { width: 26, alignItems: 'center' },
  navLabel:  { flex: 1, fontWeight: '500' },
  activeIndicator: { position: 'absolute', right: 0, top: '15%', bottom: '15%', width: 3, borderRadius: 2 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 14, marginBottom: 4, marginLeft: 14 },
  // Más separación antes del indicador de versión (pedido explícito del
  // rediseño: "margen adecuado sobre GymPro v1.0.0").
  footer:    { paddingHorizontal: 12, paddingTop: 10, gap: 10, borderTopWidth: 1 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
  logoutIcon:{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoutText:{ fontWeight: '600' },
  version:   { fontSize: 11, textAlign: 'center', paddingBottom: 4 },
});
