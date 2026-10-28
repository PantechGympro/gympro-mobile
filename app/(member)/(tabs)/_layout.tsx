/**
 * MemberTabsLayout — Bottom Navigation Bar del rol Miembro (rediseño nav. global).
 *
 * 4 secciones principales siempre visibles y de un toque: Inicio,
 * Entrenamiento, Nutrición, Perfil. Antes vivían como ítems planos del
 * Drawer (cajón); con 10+ opciones ahí, encontrarlas tomaba 2 toques
 * (abrir cajón -> elegir). Al ser las 4 pantallas de uso diario, se
 * promueven a una Tab Bar fija -- el Drawer (ver ../_layout.tsx) queda
 * para lo secundario/administrativo (Membresía, Progreso y Salud, Punto
 * de Venta, Ajustes, Notificaciones, Accesibilidad, Soporte).
 *
 * headerShown:false aquí a propósito: el header real (hamburguesa para
 * abrir el cajón + SyncStatusBadge + PerfilCompletoBadge) lo sigue
 * dibujando el Drawer padre para esta ruta -- ver el Drawer.Screen
 * name="(tabs)" en ../_layout.tsx, que calcula su `title` dinámicamente
 * según el tab activo. Si esta Tabs tuviera también headerShown:true se
 * verían dos headers apilados.
 */
import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../../hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
interface TabScreen { name: string; label: string; icon: IconName; iconActive: IconName }

export const TAB_TITULOS: Record<string, string> = {
  index:      'Inicio',
  training:   'Entrenamiento',
  nutrition:  'Nutrición y Dietas',
  profile:    'Mi Perfil',
};

const TABS: TabScreen[] = [
  { name: 'index',     label: 'Inicio',        icon: 'home-outline',      iconActive: 'home'      },
  { name: 'training',  label: 'Entrenamiento', icon: 'barbell-outline',   iconActive: 'barbell'   },
  { name: 'nutrition', label: 'Nutrición',     icon: 'nutrition-outline', iconActive: 'nutrition' },
  { name: 'profile',   label: 'Perfil',        icon: 'person-outline',    iconActive: 'person'    },
];

export default function MemberTabsLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor:  colors.border,
          borderTopWidth:  1,
          height:          56 + insets.bottom,
          paddingBottom:   insets.bottom + 6,
          paddingTop:      6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {TABS.map(({ name, label, icon, iconActive }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title:        TAB_TITULOS[name],
            tabBarLabel:  label,
            tabBarIcon:   ({ focused, color, size }) => (
              <Ionicons name={focused ? iconActive : icon} size={size} color={color} />
            ),
            tabBarAccessibilityLabel: label,
          }}
        />
      ))}
    </Tabs>
  );
}
