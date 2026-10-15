export type Dificultad = 'muyFacil' | 'facil' | 'normal' | 'desafio';

export interface Modo {
  nombre: string;
  /** Multiplicador de la vida de los enemigos. */
  vida: number;
  /** Multiplicador del daño que hacen los enemigos. */
  dano: number;
  /** Multiplicador de la velocidad de sus proyectiles. */
  balas: number;
  /** Multiplicador del oro ganado. */
  premio: number;
}

export const MODOS: Record<Dificultad, Modo> = {
  muyFacil: { nombre: 'Muy fácil', vida: 0.6, dano: 0.5, balas: 0.7, premio: 0.6 },
  facil: { nombre: 'Fácil', vida: 0.8, dano: 0.75, balas: 0.85, premio: 0.8 },
  normal: { nombre: 'Normal', vida: 1, dano: 1, balas: 1, premio: 1 },
  desafio: { nombre: 'Desafío', vida: 1.3, dano: 1.35, balas: 1.15, premio: 1.5 },
};

export const DIFICULTADES = Object.keys(MODOS) as Dificultad[];
