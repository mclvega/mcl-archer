import type { Rng } from './rng';

/** Estadísticas del arquero durante una partida. Las habilidades solo modifican estos datos. */
export interface Stats {
  vidaMax: number;
  ataque: number;
  /** Disparos por segundo. */
  cadencia: number;
  velocidad: number;
  /** Flechas en paralelo hacia delante. */
  frontales: number;
  /** Ráfagas seguidas por disparo. */
  multidisparo: number;
  diagonales: number;
  traseras: number;
  laterales: number;
  rebotes: number;
  perfora: boolean;
  fuego: boolean;
  hielo: boolean;
  veneno: boolean;
  critico: number;
  roboVida: number;
  orbes: number;
}

export function statsBase(mejoras: { ataque: number; vida: number; velocidad: number } = { ataque: 0, vida: 0, velocidad: 0 }): Stats {
  return {
    vidaMax: 100 + mejoras.vida * 20,
    ataque: 20 + mejoras.ataque * 4,
    cadencia: 1.6,
    velocidad: 120 + mejoras.velocidad * 6,
    frontales: 1,
    multidisparo: 1,
    diagonales: 0,
    traseras: 0,
    laterales: 0,
    rebotes: 0,
    perfora: false,
    fuego: false,
    hielo: false,
    veneno: false,
    critico: 0,
    roboVida: 0,
    orbes: 0,
  };
}

export interface Habilidad {
  id: string;
  nombre: string;
  icono: string;
  desc: string;
  /** Veces que se puede elegir en una partida. */
  max: number;
  peso: number;
  aplicar: (s: Stats) => void;
  /** Efecto inmediato sobre la vida actual (curación). */
  curar?: number;
}

export const HABILIDADES: readonly Habilidad[] = [
  { id: 'multi', nombre: 'Multidisparo', icono: '🏹', desc: 'Una ráfaga extra en cada disparo (−10 % de daño).', max: 3, peso: 3, aplicar: (s) => { s.multidisparo += 1; s.ataque *= 0.9; } },
  { id: 'frontal', nombre: 'Flecha frontal +1', icono: '⬆️', desc: 'Una flecha más en paralelo (−10 % de daño).', max: 3, peso: 3, aplicar: (s) => { s.frontales += 1; s.ataque *= 0.9; } },
  { id: 'diagonal', nombre: 'Flechas diagonales', icono: '↗️', desc: 'Dos flechas en diagonal.', max: 2, peso: 3, aplicar: (s) => { s.diagonales += 1; } },
  { id: 'trasera', nombre: 'Flecha trasera', icono: '⬇️', desc: 'Una flecha hacia atrás.', max: 2, peso: 2, aplicar: (s) => { s.traseras += 1; } },
  { id: 'lateral', nombre: 'Flechas laterales', icono: '↔️', desc: 'Una flecha a cada lado.', max: 2, peso: 2, aplicar: (s) => { s.laterales += 1; } },
  { id: 'rebote', nombre: 'Rebote en muros', icono: '🔁', desc: 'Las flechas rebotan en las paredes.', max: 2, peso: 2, aplicar: (s) => { s.rebotes += 1; } },
  { id: 'perfora', nombre: 'Perforación', icono: '🎯', desc: 'Las flechas atraviesan enemigos.', max: 1, peso: 2, aplicar: (s) => { s.perfora = true; } },
  { id: 'fuego', nombre: 'Flechas de fuego', icono: '🔥', desc: 'Queman al enemigo durante 2 s.', max: 1, peso: 2, aplicar: (s) => { s.fuego = true; } },
  { id: 'hielo', nombre: 'Flechas de hielo', icono: '❄️', desc: 'Ralentizan al enemigo.', max: 1, peso: 2, aplicar: (s) => { s.hielo = true; } },
  { id: 'veneno', nombre: 'Flechas de veneno', icono: '☠️', desc: 'Veneno que no se acaba.', max: 1, peso: 2, aplicar: (s) => { s.veneno = true; } },
  { id: 'ataque', nombre: 'Ataque +', icono: '⚔️', desc: '+25 % de daño.', max: 5, peso: 4, aplicar: (s) => { s.ataque *= 1.25; } },
  { id: 'cadencia', nombre: 'Velocidad de ataque +', icono: '⚡', desc: '+25 % de disparos por segundo.', max: 5, peso: 4, aplicar: (s) => { s.cadencia *= 1.25; } },
  { id: 'critico', nombre: 'Golpe crítico', icono: '💥', desc: '+10 % de probabilidad de daño doble.', max: 4, peso: 3, aplicar: (s) => { s.critico += 0.1; } },
  { id: 'vida', nombre: 'Vida máxima +', icono: '❤️', desc: '+20 % de vida máxima.', max: 5, peso: 3, aplicar: (s) => { s.vidaMax = Math.round(s.vidaMax * 1.2); }, curar: 0.2 },
  { id: 'curar', nombre: 'Curación', icono: '💚', desc: 'Recupera el 40 % de la vida.', max: 99, peso: 2, aplicar: () => {}, curar: 0.4 },
  { id: 'robo', nombre: 'Robo de vida', icono: '🩸', desc: 'Cada enemigo derrotado cura un poco.', max: 3, peso: 2, aplicar: (s) => { s.roboVida += 0.02; } },
  { id: 'velocidad', nombre: 'Pies ligeros', icono: '👟', desc: '+15 % de velocidad de movimiento.', max: 3, peso: 2, aplicar: (s) => { s.velocidad *= 1.15; } },
  { id: 'orbe', nombre: 'Orbe guardián', icono: '🔮', desc: 'Un orbe gira a tu alrededor y daña al tocar.', max: 3, peso: 2, aplicar: (s) => { s.orbes += 1; } },
];

export const habilidadPorId = (id: string) => HABILIDADES.find((h) => h.id === id);

/** Elige `n` habilidades distintas que aún se pueden tomar, al azar según su peso. */
export function sortearHabilidades(rng: Rng, tomadas: Record<string, number>, n = 3): Habilidad[] {
  const pool = HABILIDADES.filter((h) => (tomadas[h.id] ?? 0) < h.max);
  const elegidas: Habilidad[] = [];
  while (elegidas.length < n && pool.length > 0) {
    const total = pool.reduce((a, h) => a + h.peso, 0);
    let r = rng.siguiente() * total;
    let i = 0;
    while (r >= pool[i].peso) {
      r -= pool[i].peso;
      i++;
    }
    elegidas.push(pool[i]);
    pool.splice(i, 1);
  }
  return elegidas;
}

/** Ángulos (radianes, relativos a la dirección de disparo) de las flechas de una ráfaga. */
export function angulosDisparo(s: Stats): number[] {
  const angulos: number[] = [];
  for (let i = 0; i < s.diagonales; i++) angulos.push(-(0.5 + i * 0.25), 0.5 + i * 0.25);
  for (let i = 0; i < s.traseras; i++) angulos.push(Math.PI + (i - (s.traseras - 1) / 2) * 0.2);
  for (let i = 0; i < s.laterales; i++) angulos.push(-Math.PI / 2 + i * 0.2, Math.PI / 2 - i * 0.2);
  return angulos;
}

/** XP necesaria para pasar del nivel `n` al siguiente. */
export const xpParaNivel = (n: number) => Math.round(20 + n * 14);
