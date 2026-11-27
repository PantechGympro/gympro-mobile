/**
 * PantallaConTeclado — envoltura estándar para cualquier pantalla con campos
 * de texto.
 *
 * Por qué existe
 * --------------
 * Desde Expo SDK 54 las apps de Android se dibujan edge-to-edge, y eso cambia
 * el comportamiento del teclado: la ventana YA NO se redimensiona sola. Una
 * pantalla sin `KeyboardAvoidingView` deja los campos debajo del teclado, y
 * `behavior="height"` (el valor que se usaba antes en Android) encoge el
 * contenido de más y provoca saltos al cerrar el teclado.
 *
 * La documentación de Expo recomienda `behavior="padding"` en AMBAS
 * plataformas. Este componente lo centraliza para que no se vuelva a decidir
 * pantalla por pantalla.
 *
 * Importante: no combinar con `softwareKeyboardLayoutMode: "pan"` en app.json.
 * La ventana se desplazaría y además se agregaría padding, moviendo el campo
 * dos veces.
 *
 * Uso
 * ---
 *   <PantallaConTeclado>
 *     <ScrollView>…</ScrollView>
 *   </PantallaConTeclado>
 *
 * Dentro de un <Modal> funciona igual, pero debe ir DENTRO del modal: un
 * KeyboardAvoidingView en la pantalla de fondo no afecta al contenido modal.
 */
import React from 'react';
import { KeyboardAvoidingView, StyleSheet, type ViewStyle } from 'react-native';

interface Props {
  children: React.ReactNode;
  /**
   * Alto del encabezado que queda por encima del área que se desplaza. Solo
   * hace falta cuando la pantalla tiene header fijo; si no, el campo se
   * levanta de más y queda un hueco.
   */
  desplazamiento?: number;
  style?: ViewStyle;
}

export default function PantallaConTeclado({ children, desplazamiento = 0, style }: Props) {
  return (
    <KeyboardAvoidingView
      style={[styles.lleno, style]}
      behavior="padding"
      keyboardVerticalOffset={desplazamiento}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ lleno: { flex: 1 } });
