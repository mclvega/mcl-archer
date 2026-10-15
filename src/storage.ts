import { DEFAULT_LOOK, LOOK_OPTIONS, type Look } from './game/look';
import { configPorDefecto, normalizarConfig, type Configuracion } from './settings';

export interface Mejoras {
  ataque: number;
  vida: number;
  velocidad: number;
}

export interface Guardado {
  v: 1;
  nombre: string | null;
  oro: number;
  record: number;
  mejoras: Mejoras;
  /** Apariencia del arquero (mismo sistema de personajes que el Arcade). */
  look: Look;
  config: Configuracion;
}

export const CLAVE_GUARDADO = 'mcl-archer:v1';
export const MEJORA_MAX = 10;

export const guardadoNuevo = (): Guardado => ({ v: 1, nombre: null, oro: 0, record: 0, mejoras: { ataque: 0, vida: 0, velocidad: 0 }, look: { ...DEFAULT_LOOK, hat: 'none', shirt: 0x43a047 }, config: configPorDefecto() });

/** Precio en oro para subir una mejora desde el nivel `n`. */
export const precioMejora = (n: number) => 50 + n * 40;

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const entero = (v: unknown, min: number, max: number, porDefecto: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : porDefecto;

/** Valida datos guardados: cualquier campo dañado vuelve a su valor por defecto. */
export function normalizarGuardado(entrada: unknown): Guardado {
  const base = guardadoNuevo();
  if (!esObjeto(entrada)) return base;
  const m = esObjeto(entrada.mejoras) ? entrada.mejoras : {};
  return {
    v: 1,
    nombre: typeof entrada.nombre === 'string' ? limpiarNombre(entrada.nombre) : null,
    oro: entero(entrada.oro, 0, 1e9, 0),
    record: entero(entrada.record, 0, 1e6, 0),
    mejoras: {
      ataque: entero(m.ataque, 0, MEJORA_MAX, 0),
      vida: entero(m.vida, 0, MEJORA_MAX, 0),
      velocidad: entero(m.velocidad, 0, MEJORA_MAX, 0),
    },
    look: normalizarLook(entrada.look, base.look),
    config: normalizarConfig(entrada.config),
  };
}

/** Cada rasgo debe ser una de las opciones conocidas; si no, se usa el de por defecto. */
export function normalizarLook(entrada: unknown, porDefecto: Look): Look {
  if (!esObjeto(entrada)) return { ...porDefecto };
  const look = { ...porDefecto } as Record<string, unknown>;
  for (const [clave, opciones] of Object.entries(LOOK_OPTIONS)) {
    const valor = entrada[clave];
    const validos = (opciones as readonly unknown[]).map((o) => (typeof o === 'object' && o ? (o as { id: string }).id : o));
    if (validos.includes(valor)) look[clave] = valor;
  }
  return look as unknown as Look;
}

/** Nombre del jugador: 1 a 20 caracteres; letras, espacios, punto, apóstrofo y guion. */
export function limpiarNombre(texto: string): string | null {
  const limpio = texto.replace(/\s+/g, ' ').trim().slice(0, 20);
  return /^[\p{L}\p{M}\d .'-]{1,20}$/u.test(limpio) ? limpio : null;
}

function almacenSeguro(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function cargar(almacen: Pick<Storage, 'getItem'> | null = almacenSeguro()): Guardado {
  try {
    const texto = almacen?.getItem(CLAVE_GUARDADO);
    return texto ? normalizarGuardado(JSON.parse(texto)) : guardadoNuevo();
  } catch {
    return guardadoNuevo();
  }
}

export function guardar(g: Guardado, almacen: Pick<Storage, 'setItem'> | null = almacenSeguro()): void {
  try {
    almacen?.setItem(CLAVE_GUARDADO, JSON.stringify(g));
  } catch {
    // Sin almacenamiento (ventana privada o bloqueado): el juego sigue en memoria.
  }
}
