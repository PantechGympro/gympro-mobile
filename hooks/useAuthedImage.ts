/**
 * useAuthedImage — convierte una URL protegida por sesion (/api/uploads/...,
 * ver @jwt_required() en app/__init__.py del backend) en un data URI que
 * <Image> puede mostrar directamente.
 *
 * Por que hace falta: <Image source={{ uri }}> hace su propia peticion de
 * red NATIVA, que no pasa por el cliente `api` (axios) ni sus interceptores
 * -- nunca lleva el header Authorization ni se beneficia de su refresco
 * automatico de sesion. Como /api/uploads/<archivo> exige JWT a proposito
 * (protege fotos de perfil/certificados de que cualquiera con el nombre del
 * archivo los descargue sin iniciar sesion), esa peticion siempre regresaba
 * 401 -- la foto se subia bien (POST) pero nunca se llegaba a VER.
 *
 * En vez de inyectar un header Authorization fijo en el source (quedaria
 * obsoleto en cuanto el token se refresque en silencio, ya que el store de
 * auth no se entera de ese refresco), se pide el archivo con el mismo
 * cliente `api` que ya sabe reintentar con un token nuevo, y se arma un
 * data URI con la respuesta.
 */
import { useEffect, useState } from 'react';
import api from '../services/api';
import { API_BASE_URL } from '../constants/Api';

export function useAuthedImage(uri: string | null | undefined): string | null {
  const [dataUri, setDataUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    // Sin URL, data URI ya listo, o URL publica (no pasa por el /api/uploads
    // protegido, ej. fotos del carrusel publico del gimnasio): se usa tal cual.
    if (!uri || uri.startsWith('data:image') || !uri.startsWith(API_BASE_URL)) {
      setDataUri(uri || null);
      return;
    }

    (async () => {
      try {
        const ruta = uri.slice(API_BASE_URL.length);
        const resp = await api.get(ruta, { responseType: 'arraybuffer' });
        if (cancelado) return;
        const mime = (resp.headers?.['content-type'] as string) || 'image/jpeg';
        setDataUri(`data:${mime};base64,${arrayBufferABase64(resp.data)}`);
      } catch {
        if (!cancelado) setDataUri(null);
      }
    })();

    return () => { cancelado = true; };
  }, [uri]);

  return dataUri;
}

function arrayBufferABase64(buffer: ArrayBuffer): string {
  let binario = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binario += String.fromCharCode(bytes[i]);
  // btoa existe en el runtime JS de Hermes/React Native.
  return btoa(binario);
}
