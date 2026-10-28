# GymPro Móvil

Aplicación móvil de GymPro para Android, construida con React Native y Expo
(enrutamiento con expo-router). Consume la misma API REST que el portal web y ofrece la
experiencia orientada al uso diario de miembros, entrenadores, recepción y propietarios.

> **Arquitectura multi-repo:** este repo es parte de GymPro, repartido en cuatro
> repositorios bajo la organización [PantechGympro](https://github.com/PantechGympro):
> [`gympro-api`](https://github.com/PantechGympro/gympro-api),
> [`gympro-web`](https://github.com/PantechGympro/gympro-web),
> [`gympro-mobile`](https://github.com/PantechGympro/gympro-mobile) (este) e
> [`gympro-infra`](https://github.com/PantechGympro/gympro-infra),
> que contiene los `docker-compose*.yml` y la configuración de nginx.
>
> Para levantar el stack completo se clonan como carpetas hermanas y se ejecuta
> `docker compose` desde `gympro-infra/`:
>
> ```
> proyectos/
> ├── gympro-api/
> ├── gympro-web/
> └── gympro-infra/   ← aquí se corre docker compose
> ```

---

## Requisitos

| Herramienta | Notas | Enlace |
|---|---|---|
| Node.js | Versión LTS | https://nodejs.org |
| Expo CLI / EAS CLI | Se usan con `npx`, sin instalación global | — |
| Cuenta de Expo | Necesaria para compilar con EAS | https://expo.dev/signup |
| Dispositivo o emulador Android | El proyecto usa development build, no Expo Go | — |

La API debe estar levantada (ver el README de
[`gympro-api`](https://github.com/PantechGympro/gympro-api)) y accesible desde el
dispositivo en la misma red.

---

## Ejecución en desarrollo

```bash
npm install

# Iniciar el bundler de Expo
npm start          # equivale a: expo start --host lan
```

El teléfono y la computadora deben estar en la **misma red WiFi**, y los contenedores
del backend levantados (`docker compose up -d` desde `gympro-infra/`), porque la app
consume la API en el
puerto 8080 de esa máquina.

### Development build (recomendado)

El proyecto usa **development build** en lugar de Expo Go. La razón: Expo Go solo
soporta la última versión del SDK y trae un conjunto fijo de módulos nativos, por lo
que rompe cada vez que Expo publica un SDK nuevo o cuando el proyecto agrega una
librería nativa propia (por ejemplo `expo-web-browser`, que usa el checkout de pagos).

Se genera **una sola vez** y luego se reutiliza:

```bash
# 1. Generar el APK de desarrollo (tarda unos minutos, corre en la nube de Expo)
npx eas build -p android --profile development

# 2. Instalar el APK en el teléfono (link o QR que entrega EAS al terminar)

# 3. A partir de aquí, el día a día es solo esto:
npm start
#   Se abre la app instalada y se conecta al bundler. Fast Refresh incluido.
```

Solo hay que volver a generar el build cuando se agregan o actualizan **dependencias
nativas**; los cambios de JavaScript se aplican al instante con Fast Refresh.

> Si se prefiere Expo Go, debe instalarse la versión correspondiente al SDK del
> proyecto desde https://expo.dev/go (la de Google Play siempre es la más reciente y
> suele ser incompatible).

#### Dependencias nativas del proyecto

Estas obligan a regenerar el build cuando se añaden o actualizan. Se instalan siempre
con `npx expo install`, no con `npm install`, porque resuelve la versión compatible con
el SDK del proyecto:

| Paquete | Para qué |
|---|---|
| `expo-secure-store` | Guardar la sesión en el almacén seguro del sistema |
| `expo-notifications`, `expo-device` | Notificaciones push y recordatorios locales |
| `expo-web-browser` | Abrir el checkout de PayPal y Mercado Pago |
| `expo-file-system` | Descargar reportes y leer archivos adjuntos |
| `expo-image-picker` | Fotos de perfil y logotipo del gimnasio |
| `expo-document-picker` | Adjuntar certificados en PDF o imagen |
| `react-native-webview` | Ver los PDF dentro de la aplicación |
| `expo-video` | Vídeos demostrativos de los ejercicios |

### Resolución de la URL de la API

La app detecta automáticamente la URL de la API en desarrollo a partir del host del
bundler de Expo. Para fijarla de forma explícita (emuladores o producción) se usa la
variable de entorno:

```
EXPO_PUBLIC_API_BASE_URL=http://<host>:8080/api
```

Referencias por defecto: emulador Android usa `10.0.2.2:8080`; en un dispositivo físico
se usa la IP de la máquina que corre la API.

**Importante para los builds de release** (`preview` y `production`): en esos perfiles
`__DEV__` es `false`, por lo que la detección automática NO aplica y la app usaría
`localhost` — que dentro del teléfono apunta al propio teléfono. La URL debe fijarse en
el bloque `env` del perfil correspondiente en `eas.json`. En el perfil `preview` hay un
valor de ejemplo (`192.168.1.100`) que debe reemplazarse por la IP real de la máquina
(`ipconfig` → IPv4 del adaptador WiFi).

El perfil `development` no necesita esa variable: se conecta al bundler y resuelve la
IP automáticamente.

---

## Compilación (Android)

```bash
# Development build — para desarrollar (se instala una vez y se reutiliza)
npx eas build -p android --profile development

# APK instalable para probar la app compilada (requiere EXPO_PUBLIC_API_BASE_URL)
npx eas build -p android --profile preview

# Build de producción (App Bundle para Google Play)
npx eas build -p android --profile production
```

La primera vez EAS pedirá iniciar sesión (`npx eas login`) y generará automáticamente
la keystore de firma de Android.

> El proyecto no incluye `expo-updates`, por lo que **no hay actualizaciones por aire
> (OTA)**: cualquier cambio en un APK ya instalado (`preview` / `production`) exige
> generar e instalar un build nuevo. Esto no aplica al development build, donde el
> código se sirve desde el bundler.

---

## Estructura del proyecto

```
mobile/
├── app/                       # Rutas (expo-router), agrupadas por rol
│   ├── (auth)/                # login, forgot-password
│   ├── (member)/              # inicio, entrenamiento, mi-rutina, registrar entreno,
│   │                          #   nutrición, membresía, pagos, POS, salud, predicción
│   ├── (trainer)/             # dashboard, clientes, rutinas, dietas, agenda,
│   │                          #   solicitudes PT, reportes, perfil, chat
│   ├── (admin)/               # dashboard, miembros, membresías, pagos, POS, staff,
│   │                          #   reportes, suscripción, perfil, perfil del gym
│   ├── (receptionist)/        # check-ins, miembros
│   └── notifications.tsx      # Centro de notificaciones
├── components/
│   ├── ui/                    # Button, Card, Badge, SelectorFecha, SelectorPeriodo,
│   │                          #   Paginador, LoadingSpinner
│   ├── usuarios/              # DetalleUsuario, PerfilEntrenador, VisorCertificado,
│   │                          #   VisorPdf
│   ├── routines/              # RoutineDetailModal, ExerciseDetailSheet
│   ├── member/ admin/         # Tarjetas de indicadores y de membresía
│   └── navigation/ settings/  # Cajón lateral y panel de accesibilidad
├── constants/                 # Api.ts (endpoints y resolución de URL), themes.ts
├── docs/                      # SISTEMA-DE-COLOR.md
├── hooks/                     # useAuth, useColors, useFetch, ...
├── services/                  # api (axios), auth, media, pagos, push, download
├── store/                     # Estado global (auth, accesibilidad)
├── types/                     # Tipos TypeScript
└── utils/                     # Formato de datos de la API
```

---

## Características

**Navegación** por menú lateral según el rol, con cabecera de usuario, notificaciones y
ajustes de accesibilidad (tema claro/oscuro, alto contraste y tamaño de letra).

**Miembro.** Inicio con racha e indicadores, rutina del día, "Mi Rutina" para crear y
editar rutinas propias con vista a detalle ejercicio por ejercicio, registro de
entrenamiento que preselecciona el día actual, nutrición, membresías en carrusel con
pago en línea, punto de venta, salud y progreso, predicción de peso, y perfil del
entrenador con sus certificaciones y calificación.

**Entrenador.** Clientes con ficha completa, rutinas y dietas con ver y editar, agenda
con hora seleccionable y cliente obligatorio, solicitudes de entrenamiento personal,
certificaciones con documento adjunto, reportes y mensajería.

**Propietario.** Panel de indicadores, miembros y personal con detalle, membresías
editables, punto de venta con administración de productos, movimientos y ventas
filtrables por mes y año con paginación, generador de reportes en PDF, suscripción al
SaaS con carrusel de planes, y perfiles editables con foto.

**Recepción.** Registro de asistencias y consulta de miembros.

**Sesión persistente.** La sesión sobrevive al cierre de la aplicación. El token de
acceso dura 8 horas y se renueva solo con un token de refresco de 90 días, así que solo
hay que volver a entrar si se cierra sesión a propósito.

**Pagos.** Efectivo, PayPal y Mercado Pago. El checkout se abre en el navegador seguro
del sistema y vuelve a la app mediante el enlace profundo `gympro://`.

**Notificaciones.** Push remoto y recordatorios locales de racha y vencimiento de
membresía.

---

## Sistema de color

Toda la interfaz lee sus colores de `constants/themes.ts` mediante `useColors()`.
Ninguna pantalla escribe un color a mano, así que cambiar la paleta repinta la
aplicación entera. Los tokens tienen significado, no estética: `dataProgreso` es lo que
mejora, `dataRiesgo` un problema presente, `dataIa` lo que calculan los modelos.

Guía completa y pasos para añadir una paleta: [docs/SISTEMA-DE-COLOR.md](docs/SISTEMA-DE-COLOR.md)

---

## Stack

| Área | Tecnologías |
|---|---|
| Base | React Native, Expo, expo-router, TypeScript |
| Red | Axios con JWT, cabecera X-Gym-ID y renovación automática de sesión |
| Gráficas | react-native-chart-kit, react-native-svg |
| Multimedia | expo-image-picker, expo-document-picker, react-native-webview, expo-video |
| Notificaciones | expo-notifications, expo-device |
| Almacenamiento seguro | expo-secure-store |

---

---

## Flujo de trabajo

| Rama | Para qué |
|---|---|
| `dev-miguel`, `dev-francisco`, `dev-maximiliano`, `dev-carlos` | Trabajo diario; una por integrante |
| `main` | Rama integrada. **Protegida**: no admite push directo |
| `qa` | Verificación antes de preparar la entrega |
| `staging` | Preproducción |
| `prod` | Lo que corre en el servidor. **Protegida** |

1. Trabaja en tu rama `dev-<nombre>`; nunca directamente sobre `main`.
2. Abre un pull request hacia `main` y completa la plantilla
   (`.github/PULL_REQUEST_TEMPLATE.md`).
3. La integración continua (`.github/workflows/ci.yml`) debe pasar en verde y el PR
   necesita la aprobación de otro integrante.
4. Al fusionar, el workflow `sync-dev-branches.yml` baja `main` a las cuatro ramas
   `dev-*` automáticamente. Si hay conflicto se detiene y lo reporta; se resuelve a
   mano:

   ```bash
   git checkout dev-<nombre>
   git merge main       # resolver los conflictos
   git push
   ```

5. La promoción entre ambientes sigue `main → qa → staging → prod`.

### Convención de commits

Conventional Commits, con alcance opcional entre paréntesis:

| Prefijo | Para qué |
|---|---|
| `feat:` | Funcionalidad nueva |
| `fix:` | Corrección de un bug |
| `chore:` | Mantenimiento, configuración, dependencias |
| `docs:` | Solo documentación |
| `refactor:` | Cambio de estructura sin cambiar comportamiento |
| `perf:` | Mejora de rendimiento |

Ejemplos: `feat(api): cobro recurrente con Mercado Pago`, `fix(mobile): sesión no se renueva`.

**Nunca se commitean secretos ni archivos `.env`.** El repositorio versiona únicamente
`.env.example`; los valores reales se mantienen fuera de git.

La documentación del proyecto se lleva en **Jira** (proyecto `SCRUM`): los entregables y
las decisiones técnicas se adjuntan o se enlazan desde la incidencia que les corresponde.

## Notas

- Las capacidades nativas (fotos, adjuntos, visor de PDF, push) requieren el development
  build; en Expo Go se degradan de forma controlada con un aviso.
- La app está pensada como cliente de uso diario. Las tareas administrativas pesadas
  (respaldos, analítica avanzada, gestión de plataforma) se hacen desde el portal web.
- Antes de compilar conviene ejecutar `npx tsc --noEmit`.
