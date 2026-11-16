/**
 * AvatarFoto — avatar circular reutilizable para fichas y listas de personas.
 *
 * Unifica un patrón que estaba repetido (y roto en la mitad de los casos) en
 * varias pantallas: mostrar la foto de perfil si existe, o las iniciales del
 * nombre si no. El problema que resuelve es la forma en que llega la foto:
 *
 *   - Staff (Usuario.foto_perfil en Postgres): siempre un data URI base64.
 *   - Miembros (miembros.foto_perfil en Mongo): un nombre de archivo suelto,
 *     servido por la ruta protegida con JWT GET /api/uploads/<archivo>.
 *
 * Varias pantallas solo comprobaban `foto?.startsWith('data:image')`, así que
 * nunca mostraban la foto de un miembro (ver useAuthedImage.ts para el por
 * qué <Image> no puede pedir esa ruta protegida por su cuenta).
 */
import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { useAuthedImage } from '../../hooks/useAuthedImage';
import { API_BASE_URL } from '../../constants/Api';

/** Resuelve una foto cruda (data URI, URL absoluta, o nombre de archivo) a
 *  una URL que el backend sabe servir. No pide la red; solo arma la URL. */
export function resolverUrlFoto(raw?: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith('data:image') || raw.startsWith('http')) return raw;
  return `${API_BASE_URL}/uploads/${raw}`;
}

interface Props {
  /** Foto cruda tal cual la devuelve la API (ver resolverUrlFoto). */
  foto?: string | null;
  /** Nombre completo, para las iniciales de respaldo. */
  nombre?: string | null;
  /** Diámetro del círculo en puntos. */
  size: number;
  /** Radio de esquina; por defecto, size/2 (círculo perfecto). */
  borderRadius?: number;
  /** Tamaño de fuente de las iniciales; por defecto, size * 0.4. */
  fontSize?: number;
}

export default function AvatarFoto({ foto, nombre, size, borderRadius, fontSize }: Props) {
  const colors = useColors();
  // /api/uploads/<archivo> exige sesión (JWT); <Image> no puede mandar ese
  // header por su cuenta, así que se trae el archivo ya autenticado y se
  // muestra como data URI. Ver hooks/useAuthedImage.ts para el detalle.
  const uriCruda = useMemo(() => resolverUrlFoto(foto), [foto]);
  const uri = useAuthedImage(uriCruda);

  const radio = borderRadius ?? size / 2;
  const iniciales = (nombre || '?').trim().charAt(0).toUpperCase() || '?';

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: radio, backgroundColor: colors.surface }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: radio, backgroundColor: colors.accent },
      ]}
    >
      <Text style={{ color: colors.onAccent, fontSize: fontSize ?? size * 0.4, fontWeight: '800' }}>
        {iniciales}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
});
