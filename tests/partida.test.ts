import { describe, expect, it } from 'vitest';
import { MODOS } from '../src/core/difficulty';
import type { Entrada } from '../src/core/input';
import { PASO } from '../src/core/loop';
import { Partida } from '../src/game/run';

describe('partida simulada', () => {
  it('avanza sin errores, sube de nivel y termina al morir', () => {
    let fin: { sala: number } | null = null;
    let niveles = 0;
    const p: Partida = new Partida(
      { ataque: 0, vida: 0, velocidad: 0 },
      {
        subirNivel: (o) => {
          niveles++;
          p.elegir(o[0]);
        },
        angel: (o) => p.elegir(o[0]),
        fin: (r) => (fin = r),
      },
      () => MODOS.desafio,
      123,
    );
    // Quieto: dispara solo. Se mueve a ratos para cruzar la puerta.
    const entrada = { x: 0, y: 0 } as Entrada;
    for (let i = 0; i < 60 * 120 && !fin; i++) {
      entrada.y = i % 240 < 40 ? -1 : 0;
      p.actualizar(PASO, entrada);
    }
    // Ganó experiencia (mató enemigos y recogió sus gemas).
    expect(niveles + p.xp).toBeGreaterThan(0);
    expect(p.sala.numero).toBeGreaterThanOrEqual(1);
    if (fin) expect(p.terminada).toBe(true);
  });
});
