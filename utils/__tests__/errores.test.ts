import { describe, expect, it } from '@jest/globals';
import { mensajeAmigable, mensajePorEstado } from '../errores';

describe('mensajePorEstado', () => {
  it('sin código → sin conexión', () => expect(mensajePorEstado(undefined)).toMatch(/conexión/));
  it.each([401, 402, 403, 404, 408, 413, 429, 500, 503])('tiene texto propio para %i', (s) => {
    expect(mensajePorEstado(s).length).toBeGreaterThan(20);
    expect(mensajePorEstado(s)).not.toMatch(/\b\d{3}\b/);          // nunca expone el número
  });
  it('408 y 504 comparten mensaje; cualquier 5xx usa el de "de nuestro lado"', () => {
    expect(mensajePorEstado(504)).toBe(mensajePorEstado(408));
    expect(mensajePorEstado(502)).toBe(mensajePorEstado(500));
  });
});

describe('mensajeAmigable', () => {
  it('usa el texto en español que redactó la API (error o msg)', () => {
    expect(mensajeAmigable({ response: { status: 400, data: { error: 'Falta el nombre' } } })).toBe('Falta el nombre');
    expect(mensajeAmigable({ response: { status: 400, data: { msg: 'Datos incompletos' } } })).toBe('Datos incompletos');
  });
  it('en un 5xx saneado agrega el folio para soporte', () => {
    const e = { response: { status: 500, data: { error: 'Algo salió mal.', ref: 'A1B2C3' } } };
    expect(mensajeAmigable(e)).toBe('Algo salió mal. (folio A1B2C3)');
  });
  it('un folio en un 4xx no se muestra', () => {
    const e = { response: { status: 400, data: { error: 'Dato inválido', ref: 'ZZ' } } };
    expect(mensajeAmigable(e)).toBe('Dato inválido');
  });
  it('sin respuesta (red caída) → mensaje de conexión, nunca "Network Error"', () => {
    const m = mensajeAmigable({ message: 'Network Error' });
    expect(m).toMatch(/conexión/);
    expect(m).not.toMatch(/Network Error/);
  });
  it('timeout de axios → mensaje de espera', () => {
    expect(mensajeAmigable({ code: 'ECONNABORTED', message: 'timeout of 15000ms exceeded' })).toBe(mensajePorEstado(408));
  });
  it('sin texto de la API usa el código HTTP, o el "por defecto" solo en 4xx', () => {
    expect(mensajeAmigable({ response: { status: 403, data: {} } })).toBe(mensajePorEstado(403));
    expect(mensajeAmigable({ response: { status: 422, data: {} } }, 'No se pudo guardar.')).toBe('No se pudo guardar.');
    expect(mensajeAmigable({ response: { status: 500, data: {} } }, 'No se pudo guardar.')).toBe(mensajePorEstado(500));
  });
  it('tolera valores raros', () => {
    expect(() => mensajeAmigable(null)).not.toThrow();
    expect(() => mensajeAmigable(undefined)).not.toThrow();
    expect(mensajeAmigable('texto suelto')).toMatch(/conexión/);
  });
});
