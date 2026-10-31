import React from 'react';
import { Drawer } from 'expo-router/drawer';
import { getFocusedRouteNameFromRoute } from 'expo-router/react-navigation';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../hooks/useColors';
import CustomDrawer from '../../components/navigation/CustomDrawer';
import PerfilCompletoBadge from '../../components/navigation/PerfilCompletoBadge';
import SyncStatusBadge from '../../components/shared/SyncStatusBadge';
import { TAB_TITULOS } from './(tabs)/_layout';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
interface Screen { name: string; title: string; icon: IconName; iconActive: IconName }

/**
 * Rediseño de navegación global del rol Miembro (lineamientos UI/UX):
 *
 *  1. Las 4 secciones de uso diario (Inicio, Entrenamiento, Nutrición,
 *     Perfil) salieron de este Drawer y ahora viven en una Bottom
 *     Navigation Bar -- ver ./(tabs)/_layout.tsx. Aquí solo queda su
 *     contenedor, 'name="(tabs)"' más abajo, oculto del propio cajón
 *     (nadie necesita verlo en la lista: ya es la pantalla por defecto).
 *  2. El resto del Drawer queda limitado a lo secundario/administrativo:
 *     Membresía, Progreso y Salud, Punto de Venta -- y, agregados como
 *     filas manuales dentro de CustomDrawer.tsx (no son Drawer.Screen
 *     porque sus pantallas viven fuera de este grupo de rutas, o no son
 *     ni siquiera una pantalla): Ajustes, Notificaciones, Accesibilidad
 *     y Soporte.
 *  3. Se eliminaron los acordeones y las pantallas satélite: "Mi
 *     Membresía" + "Pagos" se fusionaron en una sola pantalla real,
 *     "Membresía y Pagos" (ver membership.tsx -- payments.tsx ya no
 *     existe, su lógica vive ahí adentro). "Progreso Físico" +
 *     "Predicción de Peso" (IA) se fusionaron igual en progress.tsx
 *     -- prediccion.tsx ya no existe. Solo "Salud" sigue siendo una
 *     pantalla propia (health.tsx, datos médicos/de medición distintos),
 *     alcanzable desde un acceso rápido dentro de progress.tsx.
 */
const SCREENS: Screen[] = [
  { name: 'membership', title: 'Membresía',        icon: 'card-outline',  iconActive: 'card'  },
  { name: 'progress',   title: 'Progreso y Salud',  icon: 'pulse-outline', iconActive: 'pulse' },
  { name: 'pos',         title: 'Punto de Venta',    icon: 'cart-outline',  iconActive: 'cart'  },
];

// Pantallas que siguen existiendo como rutas propias de este grupo pero ya
// no aparecen en la lista del cajón -- se alcanzan desde dentro de otra
// pantalla del flujo (ver el comentario de cada una en SCREENS/arriba y en
// progress.tsx/membership.tsx), nunca desde el menú. Mismo patrón que ya
// existía para routines/chat/start-workout/checkin-qr/mi-rutina/workout-log.
const TITULOS_OCULTOS: Record<string, string> = {
  'checkin-qr':  'Registrar entrada',
  'chat':        'Chat con tu entrenador',
  'mi-rutina':   'Mi Biblioteca',
  'workout-log': 'Registrar Entreno',
  'health':      'Salud',
};

export default function MemberLayout() {
  const colors = useColors();
  return (
    <Drawer
      drawerContent={(props) => <CustomDrawer {...props} />}
      screenOptions={{
        headerShown:             true,
        headerStyle:             { backgroundColor: colors.card },
        headerTintColor:         colors.text,
        headerTitleStyle:        { fontWeight: '700', fontSize: 18, color: colors.text },
        headerShadowVisible:     false,
        // SCRUM-102: indicador circular de pendientes, visible desde
        // cualquier pantalla del rol Miembro (headerRight aplica a todas
        // las Drawer.Screen de este layout).
        // SCRUM-168 / HU-30: SyncStatusBadge se agrega aquí mismo, no en cada
        // pantalla, para que el estado de conexión/sincronización aparezca en
        // todas sin tocarlas una por una — mismo criterio que el badge de
        // perfil.
        headerRight:             () => (
          <>
            <SyncStatusBadge />
            <PerfilCompletoBadge />
          </>
        ),
        drawerStyle:             { backgroundColor: colors.background, width: 280 },
        drawerActiveTintColor:   colors.accent,
        drawerInactiveTintColor: colors.textSecondary,
        drawerItemStyle:         { borderRadius: 12 },
        drawerLabelStyle:        { fontSize: 14, fontWeight: '500', marginLeft: -4 },
        overlayColor:            colors.overlay,
        swipeEnabled:            true,
        sceneStyle:              { backgroundColor: colors.background },
      }}
    >
      {/* Contenedor de la Bottom Tab Bar (Inicio/Entrenamiento/Nutrición/
          Perfil). Oculto de la lista del cajón: display:none, igual que las
          rutas internas de un flujo más abajo. El título del header se
          recalcula según qué tab está enfocado, para que siga diciendo
          "Inicio"/"Entrenamiento"/etc. y no el nombre técnico del grupo. */}
      <Drawer.Screen
        name="(tabs)"
        options={({ route }) => {
          const focused = getFocusedRouteNameFromRoute(route) ?? 'index';
          return {
            title:           TAB_TITULOS[focused] ?? 'GymPro',
            drawerItemStyle: { display: 'none' },
          };
        }}
      />

      {SCREENS.map(({ name, title, icon, iconActive }) => (
        <Drawer.Screen
          key={name}
          name={name}
          options={{
            title,
            drawerIcon: ({ focused, color }) => (
              <Ionicons name={focused ? iconActive : icon} size={22} color={color} />
            ),
          }}
        />
      ))}
      {([
        'routines', 'chat', 'start-workout', 'checkin-qr', 'mi-rutina', 'workout-log',
        'health',
      ] as const).map((name) => (
        <Drawer.Screen
          key={name}
          name={name}
          options={{
            drawerItemStyle: { display: 'none' },
            title: TITULOS_OCULTOS[name] ?? name,
          }}
        />
      ))}
    </Drawer>
  );
}
