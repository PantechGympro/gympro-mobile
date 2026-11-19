import { describe, expect, it } from '@jest/globals';
import { matchesSearch, toArray, toDateStr, toFirstName, toInitial, toStr } from '../format';

describe('toDateStr', () => {
  it('vacío o nulo → cadena vacía', () => {
    expect(toDateStr(null)).toBe('');
    expect(toDateStr(undefined)).toBe('');
    expect(toDateStr('')).toBe('');
  });

  it('una cadena YYYY-MM-DD se recorta tal cual, sin reinterpretarla como fecha', () => {
    expect(toDateStr('2026-11-18')).toBe('2026-11-18');
    expect(toDateStr('2026-11-18T03:30:00Z')).toBe('2026-11-18');   // UTC del día siguiente en México: NO se desplaza
  });

  it('un Date usa la fecha LOCAL (no la UTC): 19:00 en México sigue siendo ese día', () => {
    const d = new Date('2026-11-19T01:00:00Z');                    // 19:00 del 18 en CDMX (UTC-6)
    expect(toDateStr(d)).toBe('2026-11-18');
  });

  it('formato extendido de MongoDB { $date }', () => {
    expect(toDateStr({ $date: '2026-03-05' })).toBe('2026-03-05');
  });

  it('timestamp en segundos { seconds }', () => {
    expect(toDateStr({ seconds: Date.UTC(2026, 5, 15, 18) / 1000 })).toBe('2026-06-15');
  });

  it('una fecha inválida no revienta', () => {
    expect(toDateStr(new Date('no-es-fecha'))).toBe('');
    expect(toDateStr('texto')).toBe('texto');
  });

  it('respeta el recorte `chars`', () => {
    expect(toDateStr('2026-11-18', 7)).toBe('2026-11');
  });
});

describe('toStr / toInitial / toFirstName', () => {
  it('toStr convierte con respaldo', () => {
    expect(toStr('a')).toBe('a');
    expect(toStr(42)).toBe('42');
    expect(toStr(null, 'x')).toBe('x');
    expect(toStr(undefined)).toBe('');
  });
  it('toInitial', () => {
    expect(toInitial('ana')).toBe('A');
    expect(toInitial('')).toBe('?');
    expect(toInitial({ nombre: 'x' } as any)).toBe('?');
  });
  it('toFirstName', () => {
    expect(toFirstName('Ana María Pérez')).toBe('Ana');
    expect(toFirstName(null, 'Socio')).toBe('Socio');
  });
});

describe('matchesSearch', () => {
  const socio = { nombre: 'Ana Pérez', email: 'ana@x.test', edad: 31 };
  it('sin término coincide siempre', () => expect(matchesSearch(socio, ['nombre'], '')).toBe(true));
  it('ignora mayúsculas y busca en varios campos', () => {
    expect(matchesSearch(socio, ['nombre', 'email'], 'PÉREZ')).toBe(true);
    expect(matchesSearch(socio, ['nombre', 'email'], 'x.test')).toBe(true);
    expect(matchesSearch(socio, ['nombre'], 'luis')).toBe(false);
  });
  it('campos no string (número, ausente) no rompen la búsqueda', () => {
    expect(matchesSearch(socio, ['edad'], '31')).toBe(true);
    expect(matchesSearch(socio, ['inexistente'], 'a')).toBe(false);
    expect(matchesSearch(null, ['nombre'], 'a')).toBe(false);
  });
});

describe('toArray', () => {
  it('deja pasar arrays y normaliza todo lo demás a []', () => {
    expect(toArray([1, 2])).toEqual([1, 2]);
    expect(toArray(null)).toEqual([]);
    expect(toArray(undefined)).toEqual([]);
    expect(toArray({ data: [1] })).toEqual([]);
  });
});
