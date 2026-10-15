import { describe, expect, it } from 'vitest';
import { crearRng } from '../src/core/rng';
import { COLUMNAS, FILAS, INICIO, PUERTA, conectada, generarSala, tipoDeSala } from '../src/core/room';
import { HABILIDADES, angulosDisparo, sortearHabilidades, statsBase, xpParaNivel } from '../src/core/skills';
import { normalizarConfig } from '../src/settings';
import { CLAVE_GUARDADO, cargar, guardadoNuevo, normalizarGuardado } from '../src/storage';

describe('salas', () => {
  it('cada 5 hay ángel y cada 10 jefe', () => {
    expect(tipoDeSala(1)).toBe('normal');
    expect(tipoDeSala(5)).toBe('angel');
    expect(tipoDeSala(10)).toBe('jefe');
    expect(tipoDeSala(15)).toBe('angel');
  });

  it('genera salas conectadas, con inicio y puerta libres, sin fin', () => {
    const rng = crearRng(42);
    for (let n = 1; n <= 200; n++) {
      const s = generarSala(n, rng);
      expect(s.rocas).toHaveLength(COLUMNAS * FILAS);
      expect(conectada(s.rocas)).toBe(true);
      expect(s.rocas[INICIO.fila * COLUMNAS + INICIO.col]).toBe(false);
      expect(s.rocas[PUERTA.fila * COLUMNAS + PUERTA.col]).toBe(false);
      for (const e of s.enemigos) expect(s.rocas[e.fila * COLUMNAS + e.col]).toBe(false);
      if (s.tipo === 'jefe') expect(s.enemigos.map((e) => e.tipo)).toEqual(['jefe']);
      if (s.tipo === 'angel') expect(s.enemigos).toHaveLength(0);
    }
  });

  it('la misma semilla da la misma sala', () => {
    expect(generarSala(7, crearRng(1))).toEqual(generarSala(7, crearRng(1)));
  });

  it('hay más enemigos en salas profundas', () => {
    expect(generarSala(29, crearRng(3)).enemigos.length).toBeGreaterThan(generarSala(1, crearRng(3)).enemigos.length);
  });
});

describe('habilidades', () => {
  it('sortea habilidades distintas y respeta el máximo', () => {
    const rng = crearRng(5);
    const tomadas: Record<string, number> = { perfora: 1, fuego: 1 };
    for (let i = 0; i < 100; i++) {
      const op = sortearHabilidades(rng, tomadas);
      expect(op).toHaveLength(3);
      expect(new Set(op.map((h) => h.id)).size).toBe(3);
      expect(op.some((h) => h.id === 'perfora' || h.id === 'fuego')).toBe(false);
    }
  });

  it('las habilidades modifican las estadísticas', () => {
    const s = statsBase();
    HABILIDADES.find((h) => h.id === 'diagonal')!.aplicar(s);
    HABILIDADES.find((h) => h.id === 'trasera')!.aplicar(s);
    expect(angulosDisparo(s)).toHaveLength(3);
    const ataque = s.ataque;
    HABILIDADES.find((h) => h.id === 'ataque')!.aplicar(s);
    expect(s.ataque).toBeCloseTo(ataque * 1.25);
  });

  it('las mejoras permanentes suben la base', () => {
    expect(statsBase({ ataque: 2, vida: 1, velocidad: 0 }).vidaMax).toBe(120);
    expect(xpParaNivel(2)).toBeGreaterThan(xpParaNivel(1));
  });
});

describe('guardado', () => {
  it('normaliza datos dañados', () => {
    const g = normalizarGuardado({ oro: -5, record: 'x', mejoras: { ataque: 99 }, config: { dificultad: 'imposible', volumenGeneral: 500 } });
    expect(g.oro).toBe(0);
    expect(g.record).toBe(0);
    expect(g.mejoras.ataque).toBe(10);
    expect(g.config.dificultad).toBe('normal');
    expect(g.config.volumenGeneral).toBe(100);
    expect(g.config.pantallaCompleta).toBe(true);
  });

  it('pantalla completa activada por defecto', () => {
    expect(normalizarConfig(undefined).pantallaCompleta).toBe(true);
  });

  it('carga lo guardado y tolera JSON roto', () => {
    const g = { ...guardadoNuevo(), oro: 77 };
    expect(cargar({ getItem: (k) => (k === CLAVE_GUARDADO ? JSON.stringify(g) : null) }).oro).toBe(77);
    expect(cargar({ getItem: () => '{roto' }).oro).toBe(0);
  });
});
