import type { Rng } from './rng';

export const COLUMNAS = 9;
export const FILAS = 13;
export const CELDA = 40;

export type TipoEnemigo =
  | 'murcielago' | 'slime' | 'mago' | 'arquero' | 'torreta' | 'fantasma' | 'tortuga' | 'bomba'
  | 'lobo' | 'arana' | 'serpiente' | 'golem' | 'chaman' | 'esqueleto' | 'escorpion' | 'elemental'
  | 'jefe';
export type TipoSala = 'normal' | 'angel' | 'jefe';

export interface Sala {
  numero: number;
  tipo: TipoSala;
  /** `true` = roca (bloquea movimiento y flechas). Índice: fila * COLUMNAS + columna. */
  rocas: boolean[];
  /** Bioma de la sala (cambia cada 10 salas, tras el jefe). */
  mapa: IdMapa;
  /** Cuántas oleadas hay; cada enemigo indica en cuál aparece (0 = al entrar). */
  oleadas: number;
  enemigos: Array<{ tipo: TipoEnemigo; col: number; fila: number; oleada: number }>;
}

export type IdMapa = 'mazmorra' | 'bosque' | 'desierto' | 'hielo' | 'volcan' | 'cripta' | 'pantano' | 'templo';
export type Obstaculo = 'roca' | 'arbol' | 'cactus' | 'cristal' | 'magma' | 'lapida' | 'tronco' | 'columna';

export interface Mapa {
  nombre: string;
  /** Colores del piso en damero, de los muretes y del obstáculo. */
  piso: [number, number];
  muro: number;
  obstaculo: Obstaculo;
  color: number;
  /** Enemigos típicos del bioma: aparecen con más frecuencia. */
  favoritos: TipoEnemigo[];
}

export const MAPAS: Record<IdMapa, Mapa> = {
  mazmorra: { nombre: 'Mazmorra', piso: [0x2b3a6b, 0x324477], muro: 0x1b2547, obstaculo: 'roca', color: 0x6d7896, favoritos: ['murcielago', 'slime', 'arquero'] },
  bosque: { nombre: 'Bosque', piso: [0x2e5d2e, 0x376b35], muro: 0x1f3d1c, obstaculo: 'arbol', color: 0x2e7d32, favoritos: ['lobo', 'arana', 'slime'] },
  desierto: { nombre: 'Desierto', piso: [0xc9a55c, 0xd4b26a], muro: 0x8a6a35, obstaculo: 'cactus', color: 0x558b2f, favoritos: ['escorpion', 'serpiente', 'bomba'] },
  hielo: { nombre: 'Glaciar', piso: [0x9cc7e0, 0xb2d6ea], muro: 0x5b8bab, obstaculo: 'cristal', color: 0x81d4fa, favoritos: ['elemental', 'lobo', 'tortuga'] },
  volcan: { nombre: 'Volcán', piso: [0x3b1d1a, 0x4a2420], muro: 0x220f0d, obstaculo: 'magma', color: 0x5d4037, favoritos: ['golem', 'elemental', 'bomba'] },
  cripta: { nombre: 'Cripta', piso: [0x3a2f4a, 0x443857], muro: 0x221a2e, obstaculo: 'lapida', color: 0x9e9e9e, favoritos: ['esqueleto', 'fantasma', 'chaman'] },
  pantano: { nombre: 'Pantano', piso: [0x3d4a2a, 0x465532], muro: 0x262e18, obstaculo: 'tronco', color: 0x6d4c41, favoritos: ['serpiente', 'arana', 'slime'] },
  templo: { nombre: 'Templo', piso: [0xb59a6d, 0xc4aa7c], muro: 0x7a6440, obstaculo: 'columna', color: 0xe0d6c0, favoritos: ['mago', 'chaman', 'torreta'] },
};

const ORDEN_MAPAS = Object.keys(MAPAS) as IdMapa[];

/** El bioma cambia tras cada jefe (salas 1-10, 11-20...) y el ciclo se repite. */
export const mapaDeSala = (n: number): IdMapa => ORDEN_MAPAS[Math.floor((n - 1) / 10) % ORDEN_MAPAS.length];

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
  ['lobo', 3],
  ['arana', 5],
  ['serpiente', 7],
  ['escorpion', 9],
  ['esqueleto', 11],
  ['chaman', 13],
  ['elemental', 16],
  ['golem', 18],
];

type Disposicion = 'dispersa' | 'pilares' | 'pasillos' | 'islas' | 'anillo' | 'diagonal';
const DISPOSICIONES: Disposicion[] = ['dispersa', 'pilares', 'pasillos', 'islas', 'anillo', 'diagonal'];

/** Coloca obstáculos según una plantilla (siempre en espejo de izquierda a derecha). */
function disponer(d: Disposicion, numero: number, rng: Rng): boolean[] {
  const r: boolean[] = new Array(COLUMNAS * FILAS).fill(false);
  const poner = (col: number, fila: number) => {
    if (col < 0 || col >= COLUMNAS || fila < 2 || fila > FILAS - 3) return;
    r[fila * COLUMNAS + col] = true;
    r[fila * COLUMNAS + (COLUMNAS - 1 - col)] = true;
  };
  switch (d) {
    case 'dispersa': {
      const cantidad = Math.min(14, 4 + Math.floor(numero / 3));
      for (let k = 0; k < cantidad; k++) poner(rng.entero(0, COLUMNAS - 1), rng.entero(2, FILAS - 3));
      break;
    }
    case 'pilares': {
      const paso = rng.entero(2, 3);
      for (let f = 2 + rng.entero(0, 1); f <= FILAS - 3; f += paso) for (let c = 1; c < COLUMNAS / 2; c += paso) poner(c, f);
      break;
    }
    case 'pasillos': {
      for (let f = 3; f <= FILAS - 4; f += 3) {
        const hueco = rng.entero(0, 2);
        for (let c = 0; c < 4; c++) if (c !== hueco && c !== hueco + 1) poner(c, f);
      }
      break;
    }
    case 'islas': {
      for (let k = 0; k < 3; k++) {
        const c = rng.entero(0, 2);
        const f = rng.entero(2, FILAS - 4);
        poner(c, f);
        poner(c + 1, f);
        poner(c, f + 1);
        poner(c + 1, f + 1);
      }
      break;
    }
    case 'anillo': {
      const cf = Math.floor(FILAS / 2);
      for (const [c, f] of [[2, cf - 2], [3, cf - 2], [2, cf + 2], [3, cf + 2], [1, cf - 1], [1, cf + 1]]) poner(c, f);
      break;
    }
    case 'diagonal': {
      const inicio = rng.entero(2, 4);
      for (let k = 0; k < 4; k++) poner(k, inicio + k * 2);
      break;
    }
  }
  return r;
}

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

  const mapa = mapaDeSala(numero);
  if (tipo === 'normal') {
    const disposicion = numero < 3 ? 'dispersa' : rng.elegir(DISPOSICIONES);
    for (let intento = 0; intento < 50; intento++) {
      const prueba = disponer(intento < 25 ? disposicion : 'dispersa', numero, rng);
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
  let oleadas = 1;
  if (tipo === 'jefe') {
    enemigos.push({ tipo: 'jefe', col: 4, fila: 3, oleada: 0 });
  } else if (tipo === 'normal') {
    const disponibles = DESBLOQUEO.filter(([, desde]) => numero >= desde).map(([t]) => t);
    const favoritos = MAPAS[mapa].favoritos.filter((t) => disponibles.includes(t));
    oleadas = numero >= 25 ? 3 : numero >= 6 ? 2 : 1;
    for (let o = 0; o < oleadas; o++) {
      const celdas = libres.slice();
      const cantidad = Math.min(16, 3 + Math.floor(numero / 2)) - o * 2;
      for (let k = 0; k < cantidad && celdas.length; k++) {
        const [celda] = celdas.splice(rng.entero(0, celdas.length - 1), 1);
        const lista = favoritos.length && rng.siguiente() < 0.5 ? favoritos : disponibles;
        enemigos.push({ tipo: rng.elegir(lista), ...celda, oleada: o });
      }
    }
  }
  return { numero, tipo, mapa, rocas, oleadas, enemigos };
}

/** Multiplicador de vida y daño de los enemigos según la profundidad. */
export const escalaDificultad = (numero: number) => 1 + (numero - 1) * 0.12;
