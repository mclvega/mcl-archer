import './styles.css';

import { app } from './app';
import { audio } from './audio';
import { MODOS } from './core/difficulty';
import { Entrada } from './core/input';
import { iniciarBucle } from './core/loop';
import { HABILIDADES, type Habilidad } from './core/skills';
import { iniciarPantallaCompleta } from './fullscreen';
import type { Escena3D } from './game/escena3d';
import { Rendimiento, tamanoSombras } from './rendimiento';
import { ALTO, ALTO_SALA, ANCHO, HUD, Partida } from './game/run';
import { MEJORA_MAX, precioMejora, limpiarNombre, type Mejoras } from './storage';
import { panelConfiguracion } from './ui/configuracion';
import { boton, h, mostrarPanel } from './ui/dom';

const lienzo = document.getElementById('lienzo') as HTMLCanvasElement;
const ctx = lienzo.getContext('2d')!;
// La sala se dibuja en 3D debajo; el lienzo 2D lleva el HUD y las barras de vida.
const lienzo3d = document.createElement('canvas');
lienzo3d.id = 'lienzo3d';
lienzo.before(lienzo3d);
let escena: Escena3D | null = null;
/** El motor 3D (three.js) se descarga aparte: el menú aparece sin esperarlo. */
let modulo3d: Promise<typeof import('./game/escena3d')> | null = null;
const cargar3d = () => (modulo3d ??= import('./game/escena3d'));
/** Calidad automática, límite de FPS y monitor `?perf`. */
const rend = new Rendimiento(() => app.g.config.calidad, () => app.g.config.limiteFps, () => ajustarLienzo());
const entrada = new Entrada([], document.getElementById('controles')!);
let partida: Partida | null = null;

iniciarPantallaCompleta(() => app.g.config.pantallaCompleta);
app.aplicarConfig();
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('tactil');

/* ---------- Lienzo ---------- */

function ajustarLienzo() {
  const escala = Math.min(innerWidth / ANCHO, innerHeight / ALTO);
  const dpr = Math.min(2, devicePixelRatio || 1);
  const izq = (innerWidth - ANCHO * escala) / 2;
  const arriba = (innerHeight - ALTO * escala) / 2;
  lienzo.style.left = `${izq}px`;
  lienzo.style.top = `${arriba}px`;
  lienzo3d.style.left = `${izq}px`;
  lienzo3d.style.top = `${arriba + HUD * escala}px`;
  lienzo3d.style.width = `${ANCHO * escala}px`;
  lienzo3d.style.height = `${ALTO_SALA * escala}px`;
  escena?.ajustar(ANCHO * escala, ALTO_SALA * escala, rend.ratio);
  lienzo.style.width = `${ANCHO * escala}px`;
  lienzo.style.height = `${ALTO * escala}px`;
  lienzo.width = Math.round(ANCHO * escala * dpr);
  lienzo.height = Math.round(ALTO * escala * dpr);
  ctx.setTransform(escala * dpr, 0, 0, escala * dpr, 0, 0);
}
addEventListener('resize', ajustarLienzo);
ajustarLienzo();

const botonPausa = h('button', { type: 'button', class: 'boton-pausa', 'aria-label': 'Pausa', text: '⏸', onclick: () => pausar() });
document.body.append(botonPausa);

/* ---------- Pantallas ---------- */

function jugando(si: boolean) {
  document.body.classList.toggle('jugando', si);
  if (!si) entrada.limpiar();
}

function bienvenida() {
  jugando(false);
  const campo = h('input', { type: 'text', maxlength: '20', placeholder: 'Tu nombre', 'aria-label': 'Tu nombre' }) as HTMLInputElement;
  const error = h('p', { class: 'error-campo', 'aria-live': 'polite' });
  const seguir = () => {
    const nombre = limpiarNombre(campo.value);
    if (!nombre) {
      error.textContent = 'Escribe tu nombre (hasta 20 caracteres).';
      return;
    }
    app.g.nombre = nombre;
    app.guardar();
    menu();
  };
  campo.addEventListener('keydown', (e) => e.key === 'Enter' && seguir());
  mostrarPanel(
    h('div', { class: 'tarjeta' },
      h('h1', { text: '🏹 McL Archer' }),
      h('p', { class: 'texto-suave', text: 'Muévete para esquivar: disparas solo, incluso en movimiento. Cada sala es más difícil y no tiene fin.' }),
      campo,
      error,
      boton('Empezar', seguir, { variante: 'primario' }),
    ),
  );
  campo.focus();
}

function menu() {
  jugando(false);
  partida = null;
  const modo = MODOS[app.g.config.dificultad];
  mostrarPanel(
    h('div', { class: 'tarjeta' },
      h('h1', { text: '🏹 McL Archer' }),
      h('p', { class: 'texto-suave', text: `¡Hola, ${app.nombre()}! · Récord: sala ${app.g.record} · 🪙 ${app.g.oro}` }),
      boton('Jugar', jugar, { variante: 'primario', icono: '▶' }),
      boton(`Dificultad: ${modo.nombre}`, configuracion, { icono: '🎯' }),
      boton('Personaje', () => void import('./ui/personaje').then((m) => m.pantallaPersonaje(menu)), { icono: '👕' }),
      boton('Mejoras', mejoras, { icono: '⬆️' }),
      boton('Récords', records, { icono: '🏆' }),
      boton('Configuración', configuracion, { icono: '⚙️' }),
    ),
  );
}

function configuracion(volver: () => void = menu, enJuego = false) {
  mostrarPanel(
    h('div', { class: 'tarjeta ancha' },
      h('div', { class: 'cabecera' }, boton('Volver', () => volver(), { icono: '←' }), h('h2', { text: '⚙️ Configuración' })),
      panelConfiguracion({ enJuego, alReiniciar: () => (app.g.nombre ? configuracion(volver, enJuego) : bienvenida()) }),
    ),
  );
}

const NOMBRE_MEJORA: Record<keyof Mejoras, string> = { ataque: '⚔️ Ataque', vida: '❤️ Vida', velocidad: '👟 Velocidad' };

function mejoras() {
  const filas = (Object.keys(NOMBRE_MEJORA) as Array<keyof Mejoras>).map((k) => {
    const n = app.g.mejoras[k];
    const precio = precioMejora(n);
    const b = boton(n >= MEJORA_MAX ? 'Máximo' : `Subir · 🪙 ${precio}`, () => {
      app.g.oro -= precio;
      app.g.mejoras[k]++;
      app.guardar();
      mejoras();
    });
    b.disabled = n >= MEJORA_MAX || app.g.oro < precio;
    return h('div', { class: 'fila-mejora' }, h('span', { text: `${NOMBRE_MEJORA[k]} · nivel ${n}` }), b);
  });
  mostrarPanel(
    h('div', { class: 'tarjeta' },
      h('h2', { text: '⬆️ Mejoras permanentes' }),
      h('p', { class: 'texto-suave', text: `Tienes 🪙 ${app.g.oro}. Se ganan al terminar cada partida.` }),
      ...filas,
      boton('Volver', menu, { icono: '←' }),
    ),
  );
}

function records() {
  mostrarPanel(
    h('div', { class: 'tarjeta' },
      h('h2', { text: '🏆 Récords' }),
      h('p', { class: 'texto-suave', text: `${app.nombre()}: la sala más lejana es la ${app.g.record}.` }),
      boton('Volver', menu, { icono: '←' }),
    ),
  );
}

async function jugar() {
  audio.iniciar();
  if (!escena) {
    const { Escena3D } = await cargar3d();
    escena = new Escena3D(lienzo3d, ANCHO, ALTO_SALA);
    ajustarLienzo();
  }
  partida = new Partida(app.g.mejoras, { subirNivel: (o) => elegirHabilidad('⭐ ¡Subiste de nivel!', o), angel: (o) => elegirHabilidad('👼 El ángel te ofrece', o), fin }, () => MODOS[app.g.config.dificultad]);
  mostrarPanel(null);
  jugando(true);
}

function elegirHabilidad(titulo: string, opciones: Habilidad[]) {
  jugando(false);
  const tomadas = partida!.tomadas;
  mostrarPanel(
    h('div', { class: 'tarjeta' },
      h('h2', { text: titulo }),
      h('p', { class: 'texto-suave', text: 'Elige una habilidad' }),
      h('div', { class: 'opciones' },
        ...opciones.map((o) => {
          const b = boton(`${o.icono} ${o.nombre}`, () => {
            partida!.elegir(o);
            mostrarPanel(null);
            jugando(true);
          }, { variante: 'secundario' });
          b.classList.add('eleccion');
          b.querySelector('.btn-texto')!.append(h('small', { text: `${o.desc}${tomadas[o.id] ? ` (tienes ${tomadas[o.id]})` : ''}` }));
          return b;
        }),
      ),
    ),
  );
}

function pausar() {
  if (!partida || partida.pausada || partida.terminada) return;
  partida.pausada = true;
  jugando(false);
  const tomadas = Object.entries(partida.tomadas).map(([id, n]) => {
    const hab = HABILIDADES.find((x) => x.id === id)!;
    return `${hab.icono}${n > 1 ? `×${n}` : ''}`;
  });
  mostrarPanel(
    h('div', { class: 'tarjeta' },
      h('h2', { text: '⏸ Pausa' }),
      h('p', { class: 'texto-suave', text: tomadas.length ? `Habilidades: ${tomadas.join(' ')}` : 'Aún no tienes habilidades.' }),
      boton('Continuar', continuar, { variante: 'primario', icono: '▶' }),
      boton('Configuración', () => configuracion(pausar2, true), { icono: '⚙️' }),
      boton('Salir al menú', () => {
        if (partida) fin({ sala: partida.sala.numero, oro: partida.oro, nivel: partida.nivel });
      }, { icono: '🚪' }),
    ),
  );
}

/** Vuelve a la pausa desde la configuración sin reanudar. */
function pausar2() {
  if (!partida) return menu();
  partida.pausada = false;
  pausar();
}

function continuar() {
  if (!partida) return;
  partida.pausada = false;
  mostrarPanel(null);
  jugando(true);
}

function fin(r: { sala: number; oro: number; nivel: number }) {
  if (partida) partida.terminada = true;
  jugando(false);
  const nuevoRecord = r.sala > app.g.record;
  app.g.oro += r.oro;
  app.g.record = Math.max(app.g.record, r.sala);
  app.guardar();
  mostrarPanel(
    h('div', { class: 'tarjeta' },
      h('h2', { text: nuevoRecord ? '🏆 ¡Nuevo récord!' : 'Fin de la partida' }),
      h('p', { class: 'texto-suave', text: `Llegaste a la sala ${r.sala} con nivel ${r.nivel}. Ganaste 🪙 ${r.oro}.` }),
      boton('Reintentar', jugar, { variante: 'primario', icono: '↻' }),
      boton('Mejoras', mejoras, { icono: '⬆️' }),
      boton('Menú', menu, { icono: '🏠' }),
    ),
  );
}

addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (partida?.pausada && !partida.terminada && document.querySelector('.tarjeta h2')?.textContent === '⏸ Pausa') continuar();
    else pausar();
  }
});
document.addEventListener('visibilitychange', () => document.hidden && pausar());
addEventListener('pointerdown', () => audio.iniciar());

/* ---------- Bucle ---------- */

let fps = 60;
let ultimo = performance.now();
iniciarBucle(
  (dt) =>
    rend.medir('logica', () => {
      entrada.actualizar();
      partida?.actualizar(dt, entrada);
    }),
  () => {
    const ahora = performance.now();
    if (!rend.debeDibujar(ahora, !partida || partida.pausada)) return;
    fps = fps * 0.9 + (1000 / Math.max(1, ahora - ultimo)) * 0.1;
    ultimo = ahora;
    ctx.clearRect(0, 0, ANCHO, ALTO);
    if (partida && escena) {
      const e = escena;
      const p = partida;
      e.sombras(tamanoSombras(app.g.config.calidad));
      rend.medir('render', () => e.dibujar(p, app.g.look, !app.g.config.animacionesReducidas));
      p.dibujarHud(ctx, e.proyectar);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, ANCHO, ALTO);
    }
    if (app.g.config.mostrarFps) {
      ctx.fillStyle = '#9f9';
      ctx.font = '11px monospace';
      ctx.fillText(`${Math.round(fps)} FPS`, 8, ALTO - 8);
    }
    rend.actualizarMonitor(escena?.renderer ?? null);
  },
);

if (import.meta.env.DEV && location.search.includes('demo')) void jugar();
else if (app.g.nombre) menu();
else bienvenida();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}

// Con el menú ya visible, se descarga el motor 3D en segundo plano para que «Jugar» sea instantáneo.
addEventListener('load', () => setTimeout(() => void cargar3d(), 800));
