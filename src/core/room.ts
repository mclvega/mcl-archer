import type { Rng } from './rng';

export const COLUMNAS = 9;
export const FILAS = 13;
export const CELDA = 40;

export type TipoEnemigo = 'murcielago' | 'slime' | 'mago' | 'arquero' | 'torreta' | 'fantasma' | 'tortuga' | 'bomba' | 'jefe';
export type TipoSala = 'normal' | 'angel' | 'jefe';

export interface Sala {
  numero: number;
  tipo: TipoSala;
  /** `true` = roca (bloquea movimiento y flechas). Índice: fila * COLUMNAS + columna. */
  rocas: boolean[];
  enemigos: Array<{ tipo: TipoEnemigo; col: number; fila: number }>;
}

/** Celda de aparición del jugador (abajo al centro) y de la puerta (arriba al centro). */
export const INICIO = { col: 4, fila: FILAS - 1 };
export const PUERTA = { col: 4, fila: 0 };

export const tipoDeSala = (n: number): TipoSala => (n % 10 === 0 ? 'jefe' : n % 5 === 0 ? 'angel' : 'normal');

/** Enemigos que pueden aparecer a partir de cierta profundidad. */
const DESBLOQUEO: Array<[TipoEnemigo, number]> = [
  ['murcielago', 1],
  ['slime', 1],
  ['arquero', 2],
  ['mago', 4],
  ['torreta', 6],
  ['tortuga', 8],
  ['fantasma', 12],
  ['bomba', 14],
];

/** Todas las celdas libres son alcanzables desde el inicio (sin rocas que encierren zonas). */
export function conectada(rocas: boolean[]): boolean {
  const libres = rocas.filter((r) => !r).length;
  const visto = new Set<number>([INICIO.fila * COLUMNAS + INICIO.col]);
  const cola = [INICIO.fila * COLUMNAS + INICIO.col];
  while (cola.length) {
    const i = cola.pop()!;
    const c = i % COLUMNAS;
    const f = Math.floor(i / COLUMNAS);
    for (const [dc, df] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nf = f + df;
      if (nc < 0 || nf < 0 || nc >= COLUMNAS || nf >= FILAS) continue;
      const j = nf * COLUMNAS + nc;
      if (rocas[j] || visto.has(j)) continue;
      visto.add(j);
      cola.push(j);
    }
  }
  return visto.size === libres;
}

export function generarSala(numero: number, rng: Rng): Sala {
  const tipo = tipoDeSala(numero);
  const total = COLUMNAS * FILAS;
  let rocas: boolean[] = new Array(total).fill(false);

  if (tipo === 'normal') {
    const cantidad = Math.min(14, 4 + Math.floor(numero / 3));
    for (let intento = 0; intento < 50; intento++) {
      const prueba: boolean[] = new Array(total).fill(false);
      for (let k = 0; k < cantidad; k++) {
        const col = rng.entero(0, COLUMNAS - 1);
        const fila = rng.entero(2, FILAS - 3);
        prueba[fila * COLUMNAS + col] = true;
        // Las rocas se colocan en espejo para que la sala se vea ordenada.
        prueba[fila * COLUMNAS + (COLUMNAS - 1 - col)] = true;
      }
      if (conectada(prueba)) {
        rocas = prueba;
        break;
      }
    }
  }

  const libres: Array<{ col: number; fila: number }> = [];
  for (let fila = 1; fila < FILAS - 4; fila++) {
    for (let col = 0; col < COLUMNAS; col++) if (!rocas[fila * COLUMNAS + col]) libres.push({ col, fila });
  }

  const enemigos: Sala['enemigos'] = [];
  if (tipo === 'jefe') {
    enemigos.push({ tipo: 'jefe', col: 4, fila: 3 });
  } else if (tipo === 'normal') {
    const disponibles = DESBLOQUEO.filter(([, desde]) => numero >= desde).map(([t]) => t);
    const cantidad = Math.min(9, 2 + Math.floor(numero / 2.5));
    for (let k = 0; k < cantidad && libres.length; k++) {
      const i = rng.entero(0, libres.length - 1);
      const [celda] = libres.splice(i, 1);
      enemigos.push({ tipo: rng.elegir(disponibles), ...celda });
    }
  }
  return { numero, tipo, rocas, enemigos };
}

/** Multiplicador de vida y daño de los enemigos según la profundidad. */
export const escalaDificultad = (numero: number) => 1 + (numero - 1) * 0.12;
