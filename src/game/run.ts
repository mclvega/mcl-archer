import { audio } from '../audio';
import type { Entrada } from '../core/input';
import { crearRng, type Rng } from '../core/rng';
import { CELDA, COLUMNAS, FILAS, INICIO, PUERTA, escalaDificultad, generarSala, type Sala, type TipoEnemigo } from '../core/room';
import type { Modo } from '../core/difficulty';
import { angulosDisparo, sortearHabilidades, statsBase, xpParaNivel, type Habilidad, type Stats } from '../core/skills';
import type { Mejoras } from '../storage';

export const ANCHO = COLUMNAS * CELDA; // 360
export const ALTO_SALA = FILAS * CELDA; // 520
export const HUD = 64;
export const ALTO = ALTO_SALA + HUD;

interface Enemigo {
  tipo: TipoEnemigo;
  x: number;
  y: number;
  r: number;
  vida: number;
  vidaMax: number;
  vel: number;
  dano: number;
  cd: number;
  t: number;
  vx: number;
  vy: number;
  lento: number;
  quema: number;
  veneno: number;
  flash: number;
  mini?: boolean;
  orbeCd: number;
}

interface Flecha {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dano: number;
  rebotes: number;
  golpeados: Set<Enemigo>;
}

interface Bala {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dano: number;
}

interface Recogible {
  x: number;
  y: number;
  tipo: 'xp' | 'oro';
  valor: number;
}

interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  color: string;
}

const COLOR: Record<TipoEnemigo, string> = {
  murcielago: '#9b6bff',
  slime: '#53d86a',
  mago: '#ff6bd5',
  arquero: '#e6a04b',
  torreta: '#8aa0b8',
  fantasma: '#cfe3ff',
  tortuga: '#3fae8e',
  bomba: '#ff4a3d',
  jefe: '#ff3366',
};

const BASE: Record<TipoEnemigo, { vida: number; r: number; vel: number; dano: number }> = {
  murcielago: { vida: 40, r: 11, vel: 55, dano: 12 },
  slime: { vida: 60, r: 14, vel: 40, dano: 12 },
  mago: { vida: 70, r: 13, vel: 30, dano: 14 },
  arquero: { vida: 50, r: 12, vel: 25, dano: 14 },
  torreta: { vida: 90, r: 15, vel: 0, dano: 12 },
  fantasma: { vida: 60, r: 12, vel: 48, dano: 14 },
  tortuga: { vida: 150, r: 16, vel: 22, dano: 18 },
  bomba: { vida: 30, r: 10, vel: 80, dano: 30 },
  jefe: { vida: 1400, r: 30, vel: 45, dano: 20 },
};

export interface EventosPartida {
  subirNivel: (opciones: Habilidad[]) => void;
  angel: (opciones: Habilidad[]) => void;
  fin: (resumen: { sala: number; oro: number; nivel: number }) => void;
}

export class Partida {
  stats: Stats;
  vida: number;
  nivel = 1;
  xp = 0;
  oro = 0;
  sala!: Sala;
  tomadas: Record<string, number> = {};
  pausada = false;
  terminada = false;
  private rng: Rng;
  private jugador = { x: 0, y: 0, r: 11, cd: 0, invul: 0, dirX: 0, dirY: -1, moviendo: false };
  private rafagas: Array<{ t: number; angulo: number }> = [];
  private enemigos: Enemigo[] = [];
  private flechas: Flecha[] = [];
  private balas: Bala[] = [];
  private recogibles: Recogible[] = [];
  private particulas: Particula[] = [];
  private puertaAbierta = false;
  private angel: { x: number; y: number; usado: boolean } | null = null;
  private nivelesPendientes = 0;
  private tiempo = 0;
  private temblor = 0;

  /** modo se lee al entrar en cada sala: un cambio de dificultad se aplica en la siguiente. */
  constructor(mejoras: Mejoras, private eventos: EventosPartida, private modo: () => Modo, semilla = Date.now()) {
    this.rng = crearRng(semilla);
    this.stats = statsBase(mejoras);
    this.vida = this.stats.vidaMax;
    this.entrarSala(1);
  }

  /* ---------- Salas ---------- */

  private modoSala!: Modo;

  private entrarSala(numero: number) {
    this.modoSala = this.modo();
    this.sala = generarSala(numero, this.rng);
    this.jugador.x = (INICIO.col + 0.5) * CELDA;
    this.jugador.y = (INICIO.fila + 0.5) * CELDA;
    this.flechas = [];
    this.balas = [];
    this.recogibles = [];
    this.rafagas = [];
    const escala = escalaDificultad(numero);
    this.enemigos = this.sala.enemigos.map((e) => this.crearEnemigo(e.tipo, (e.col + 0.5) * CELDA, (e.fila + 0.5) * CELDA, escala));
    this.angel = this.sala.tipo === 'angel' ? { x: ANCHO / 2, y: ALTO_SALA / 2 - 40, usado: false } : null;
    this.puertaAbierta = this.enemigos.length === 0 && !this.angel;
  }

  private crearEnemigo(tipo: TipoEnemigo, x: number, y: number, escala: number, mini = false): Enemigo {
    const b = BASE[tipo];
    const vida = b.vida * escala * this.modoSala.vida * (mini ? 0.35 : 1);
    return {
      tipo, x, y, mini,
      r: mini ? b.r * 0.65 : b.r,
      vida, vidaMax: vida,
      vel: b.vel * (mini ? 1.3 : 1),
      dano: b.dano * Math.sqrt(escala) * this.modoSala.dano,
      cd: 1 + this.rng.siguiente() * 1.5,
      t: 0, vx: 0, vy: 0, lento: 0, quema: 0, veneno: 0, flash: 0, orbeCd: 0,
    };
  }

  private solido(col: number, fila: number): boolean {
    if (col < 0 || col >= COLUMNAS || fila < 0 || fila >= FILAS) return true;
    return this.sala.rocas[fila * COLUMNAS + col];
  }

  private chocaMuro(x: number, y: number, r: number): boolean {
    const c0 = Math.floor((x - r) / CELDA);
    const c1 = Math.floor((x + r) / CELDA);
    const f0 = Math.floor((y - r) / CELDA);
    const f1 = Math.floor((y + r) / CELDA);
    for (let f = f0; f <= f1; f++) {
      for (let c = c0; c <= c1; c++) {
        if (!this.solido(c, f)) continue;
        const cx = Math.max(c * CELDA, Math.min(x, (c + 1) * CELDA));
        const cy = Math.max(f * CELDA, Math.min(y, (f + 1) * CELDA));
        if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
      }
    }
    return false;
  }

  /** Mueve un círculo por ejes para que se deslice junto a los muros. */
  private mover(o: { x: number; y: number; r: number }, dx: number, dy: number, atraviesa = false) {
    const limite = (v: number, max: number) => Math.max(o.r, Math.min(max - o.r, v));
    if (atraviesa) {
      o.x = limite(o.x + dx, ANCHO);
      o.y = limite(o.y + dy, ALTO_SALA);
      return;
    }
    if (!this.chocaMuro(o.x + dx, o.y, o.r)) o.x += dx;
    if (!this.chocaMuro(o.x, o.y + dy, o.r)) o.y += dy;
  }

  /* ---------- Actualización ---------- */

  actualizar(dt: number, entrada: Entrada) {
    if (this.pausada || this.terminada) return;
    this.tiempo += dt;
    this.temblor = Math.max(0, this.temblor - dt * 20);
    this.actualizarJugador(dt, entrada);
    this.actualizarEnemigos(dt);
    this.actualizarFlechas(dt);
    this.actualizarBalas(dt);
    this.actualizarRecogibles(dt);
    for (const p of this.particulas) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vida -= dt;
    }
    this.particulas = this.particulas.filter((p) => p.vida > 0);

    if (!this.puertaAbierta && this.enemigos.length === 0 && (!this.angel || this.angel.usado)) {
      this.puertaAbierta = true;
      audio.efecto('nivel');
    }
    if (this.nivelesPendientes > 0 && !this.pausada) {
      this.nivelesPendientes--;
      this.ofrecer('subirNivel');
    }
  }

  private ofrecer(tipo: 'subirNivel' | 'angel') {
    this.pausada = true;
    this.eventos[tipo](sortearHabilidades(this.rng, this.tomadas));
  }

  /** Aplica la habilidad elegida en la pantalla de subida de nivel o del ángel. */
  elegir(h: Habilidad) {
    const antes = this.stats.vidaMax;
    h.aplicar(this.stats);
    this.tomadas[h.id] = (this.tomadas[h.id] ?? 0) + 1;
    this.vida += this.stats.vidaMax - antes;
    if (h.curar) this.vida = Math.min(this.stats.vidaMax, this.vida + this.stats.vidaMax * h.curar);
    this.pausada = false;
  }

  private actualizarJugador(dt: number, entrada: Entrada) {
    const j = this.jugador;
    j.invul = Math.max(0, j.invul - dt);
    j.moviendo = Math.hypot(entrada.x, entrada.y) > 0.15;
    if (j.moviendo) {
      j.dirX = entrada.x;
      j.dirY = entrada.y;
      this.mover(j, entrada.x * this.stats.velocidad * dt, entrada.y * this.stats.velocidad * dt);
    }

    // Disparo automático: solo con el arquero quieto, como en el género.
    j.cd -= dt;
    const objetivo = this.masCercano();
    if (!j.moviendo && objetivo && j.cd <= 0) {
      j.cd = 1 / this.stats.cadencia;
      const angulo = Math.atan2(objetivo.y - j.y, objetivo.x - j.x);
      for (let i = 0; i < this.stats.multidisparo; i++) this.rafagas.push({ t: i * 0.1, angulo });
    }
    for (const r of this.rafagas) {
      r.t -= dt;
      if (r.t <= 0) this.disparar(r.angulo);
    }
    this.rafagas = this.rafagas.filter((r) => r.t > 0);

    // Orbes guardianes.
    for (let i = 0; i < this.stats.orbes; i++) {
      const a = this.tiempo * 3 + (i * Math.PI * 2) / this.stats.orbes;
      const ox = j.x + Math.cos(a) * 42;
      const oy = j.y + Math.sin(a) * 42;
      for (const e of this.enemigos) {
        if (e.orbeCd > 0 || (e.x - ox) ** 2 + (e.y - oy) ** 2 > (e.r + 8) ** 2) continue;
        e.orbeCd = 0.4;
        this.danar(e, this.stats.ataque * 0.6);
      }
    }

    if (this.angel && !this.angel.usado && Math.hypot(this.angel.x - j.x, this.angel.y - j.y) < 28) {
      this.angel.usado = true;
      this.ofrecer('angel');
    }

    if (this.puertaAbierta && j.y < CELDA * 0.6 && Math.abs(j.x - (PUERTA.col + 0.5) * CELDA) < CELDA * 0.7) {
      this.entrarSala(this.sala.numero + 1);
    }
  }

  private masCercano(): Enemigo | null {
    let mejor: Enemigo | null = null;
    let d = Infinity;
    for (const e of this.enemigos) {
      const de = (e.x - this.jugador.x) ** 2 + (e.y - this.jugador.y) ** 2;
      if (de < d) {
        d = de;
        mejor = e;
      }
    }
    return mejor;
  }

  private disparar(angulo: number) {
    const j = this.jugador;
    const s = this.stats;
    const v = 420;
    const crear = (a: number, desplazamiento: number) => {
      const px = -Math.sin(a) * desplazamiento;
      const py = Math.cos(a) * desplazamiento;
      const critico = this.rng.siguiente() < s.critico;
      this.flechas.push({
        x: j.x + px, y: j.y + py,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        dano: s.ataque * (critico ? 2 : 1),
        rebotes: s.rebotes,
        golpeados: new Set(),
      });
    };
    for (let i = 0; i < s.frontales; i++) crear(angulo, (i - (s.frontales - 1) / 2) * 9);
    for (const extra of angulosDisparo(s)) crear(angulo + extra, 0);
    audio.efecto('disparo');
  }

  private actualizarEnemigos(dt: number) {
    const j = this.jugador;
    const escala = escalaDificultad(this.sala.numero);
    const nuevos: Enemigo[] = [];
    for (const e of this.enemigos) {
      e.t += dt;
      e.cd -= dt;
      e.flash = Math.max(0, e.flash - dt);
      e.orbeCd = Math.max(0, e.orbeCd - dt);
      e.lento = Math.max(0, e.lento - dt);
      if (e.quema > 0) {
        e.quema -= dt;
        e.vida -= this.stats.ataque * 0.35 * dt;
      }
      if (e.veneno > 0) e.vida -= this.stats.ataque * 0.12 * dt;

      const factor = e.lento > 0 ? 0.5 : 1;
      const dx = j.x - e.x;
      const dy = j.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;
      const vel = e.vel * factor;

      switch (e.tipo) {
        case 'murcielago':
          if (e.cd <= 0) {
            e.vx = ux * 230;
            e.vy = uy * 230;
            e.cd = 2.2;
            e.t = 0;
          }
          if (e.t < 0.45) this.mover(e, e.vx * factor * dt, e.vy * factor * dt);
          else this.mover(e, Math.cos(e.t * 2) * vel * dt, Math.sin(e.t * 3) * vel * dt);
          break;
        case 'slime':
        case 'tortuga':
          this.mover(e, ux * vel * dt, uy * vel * dt);
          break;
        case 'fantasma':
          this.mover(e, ux * vel * dt, uy * vel * dt, true);
          break;
        case 'bomba':
          this.mover(e, ux * vel * dt, uy * vel * dt);
          if (dist < e.r + j.r + 14) {
            e.vida = 0;
            this.explosion(e.x, e.y, 60, e.dano);
          }
          break;
        case 'arquero':
          this.mover(e, -uy * vel * dt * Math.sin(e.t), ux * vel * dt * Math.sin(e.t));
          if (e.cd <= 0) {
            e.cd = 1.9;
            this.bala(e, Math.atan2(dy, dx), 170, e.dano);
          }
          break;
        case 'mago':
          if (e.cd <= 0) {
            e.cd = 2.6;
            const base = Math.atan2(dy, dx);
            for (let k = -2; k <= 2; k++) this.bala(e, base + k * 0.22, 140, e.dano);
          }
          break;
        case 'torreta':
          if (e.cd <= 0) {
            e.cd = 3;
            const giro = this.rng.siguiente();
            for (let k = 0; k < 8; k++) this.bala(e, giro + (k * Math.PI) / 4, 120, e.dano);
          }
          break;
        case 'jefe': {
          const furioso = e.vida < e.vidaMax / 2;
          this.mover(e, ux * vel * (furioso ? 1.4 : 1) * dt, uy * vel * (furioso ? 1.4 : 1) * dt);
          if (e.cd <= 0) {
            e.cd = furioso ? 1.2 : 2;
            const n = furioso ? 16 : 10;
            const giro = this.tiempo;
            for (let k = 0; k < n; k++) this.bala(e, giro + (k * Math.PI * 2) / n, 130, e.dano * 0.8);
            if (furioso) this.bala(e, Math.atan2(dy, dx), 220, e.dano);
          }
          break;
        }
      }

      // Daño por contacto.
      if (dist < e.r + j.r && j.invul <= 0) this.herirJugador(e.dano);

      if (e.vida <= 0) {
        this.morir(e);
        if (e.tipo === 'slime' && !e.mini) {
          nuevos.push(this.crearEnemigo('slime', e.x - 10, e.y, escala, true), this.crearEnemigo('slime', e.x + 10, e.y, escala, true));
        }
      }
    }
    this.enemigos = this.enemigos.filter((e) => e.vida > 0).concat(nuevos);
  }

  private bala(e: Enemigo, angulo: number, v: number, dano: number) {
    const vb = v * this.modoSala.balas;
    this.balas.push({ x: e.x, y: e.y, vx: Math.cos(angulo) * vb, vy: Math.sin(angulo) * vb, r: 5, dano });
  }

  private explosion(x: number, y: number, radio: number, dano: number) {
    audio.efecto('explosion');
    this.temblor = 6;
    for (let i = 0; i < 24; i++) this.chispa(x, y, i % 2 ? '#ffb347' : '#ff4a3d', 160);
    if (Math.hypot(this.jugador.x - x, this.jugador.y - y) < radio && this.jugador.invul <= 0) this.herirJugador(dano);
  }

  private chispa(x: number, y: number, color: string, fuerza = 90) {
    const a = this.rng.siguiente() * Math.PI * 2;
    const v = fuerza * (0.3 + this.rng.siguiente());
    this.particulas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 0.3 + this.rng.siguiente() * 0.3, color });
  }

  private herirJugador(dano: number) {
    this.vida -= dano;
    this.jugador.invul = 0.7;
    this.temblor = 4;
    audio.efecto('dano');
    if (this.vida <= 0) {
      this.vida = 0;
      this.terminada = true;
      audio.efecto('muerte');
      this.eventos.fin({ sala: this.sala.numero, oro: this.oro, nivel: this.nivel });
    }
  }

  private danar(e: Enemigo, dano: number) {
    e.vida -= e.tipo === 'tortuga' ? dano * 0.5 : dano;
    e.flash = 0.08;
    if (this.stats.fuego) e.quema = 2;
    if (this.stats.hielo) e.lento = 1.5;
    if (this.stats.veneno) e.veneno = 1;
    audio.efecto('golpe');
  }

  private morir(e: Enemigo) {
    for (let i = 0; i < 12; i++) this.chispa(e.x, e.y, COLOR[e.tipo]);
    const jefe = e.tipo === 'jefe';
    this.recogibles.push({ x: e.x, y: e.y, tipo: 'xp', valor: jefe ? 120 : e.mini ? 4 : 10 });
    this.recogibles.push({ x: e.x + 6, y: e.y - 4, tipo: 'oro', valor: jefe ? 60 : this.rng.entero(1, 3) });
    if (this.stats.roboVida > 0) this.vida = Math.min(this.stats.vidaMax, this.vida + this.stats.vidaMax * this.stats.roboVida);
    audio.efecto('muerte');
  }

  private actualizarFlechas(dt: number) {
    const vivas: Flecha[] = [];
    for (const f of this.flechas) {
      const nx = f.x + f.vx * dt;
      const ny = f.y + f.vy * dt;
      const col = Math.floor(nx / CELDA);
      const fila = Math.floor(ny / CELDA);
      if (this.solido(col, fila)) {
        if (f.rebotes <= 0) {
          this.chispa(f.x, f.y, '#fff');
          continue;
        }
        f.rebotes--;
        if (this.solido(Math.floor(nx / CELDA), Math.floor(f.y / CELDA))) f.vx = -f.vx;
        else f.vy = -f.vy;
        f.golpeados.clear();
        vivas.push(f);
        continue;
      }
      f.x = nx;
      f.y = ny;
      let viva = true;
      for (const e of this.enemigos) {
        if (f.golpeados.has(e) || (e.x - f.x) ** 2 + (e.y - f.y) ** 2 > (e.r + 3) ** 2) continue;
        this.danar(e, f.dano);
        f.golpeados.add(e);
        if (!this.stats.perfora) {
          viva = false;
          break;
        }
      }
      if (viva) vivas.push(f);
    }
    this.flechas = vivas;
  }

  private actualizarBalas(dt: number) {
    const j = this.jugador;
    this.balas = this.balas.filter((b) => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (this.solido(Math.floor(b.x / CELDA), Math.floor(b.y / CELDA))) return false;
      if ((b.x - j.x) ** 2 + (b.y - j.y) ** 2 < (b.r + j.r - 2) ** 2) {
        if (j.invul <= 0) this.herirJugador(b.dano);
        return false;
      }
      return true;
    });
  }

  private actualizarRecogibles(dt: number) {
    const j = this.jugador;
    const iman = this.enemigos.length === 0;
    this.recogibles = this.recogibles.filter((r) => {
      const dx = j.x - r.x;
      const dy = j.y - r.y;
      const d = Math.hypot(dx, dy) || 1;
      if (iman || d < 60) {
        r.x += (dx / d) * 380 * dt;
        r.y += (dy / d) * 380 * dt;
      }
      if (d > 16) return true;
      audio.efecto('recoger');
      if (r.tipo === 'oro') this.oro += Math.max(1, Math.round(r.valor * this.modoSala.premio));
      else this.ganarXp(r.valor);
      return false;
    });
  }

  private ganarXp(valor: number) {
    this.xp += valor;
    while (this.xp >= xpParaNivel(this.nivel)) {
      this.xp -= xpParaNivel(this.nivel);
      this.nivel++;
      this.nivelesPendientes++;
      audio.efecto('nivel');
    }
  }

  /* ---------- Dibujo ---------- */

  dibujar(ctx: CanvasRenderingContext2D, efectos = true) {
    ctx.save();
    if (efectos && this.temblor > 0) ctx.translate((this.rng.siguiente() - 0.5) * this.temblor, (this.rng.siguiente() - 0.5) * this.temblor);

    // HUD
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, ANCHO, HUD);
    ctx.fillStyle = '#f2f4ff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    const tipo = this.sala.tipo === 'jefe' ? ' · JEFE' : this.sala.tipo === 'angel' ? ' · Ángel' : '';
    ctx.fillText(`Sala ${this.sala.numero}${tipo}`, 12, 20);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffcf4a';
    ctx.fillText(`🪙 ${this.oro}`, ANCHO - 64, 20);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#2a3460';
    ctx.fillRect(12, 40, ANCHO - 24, 12);
    ctx.fillStyle = '#4ad1ff';
    ctx.fillRect(12, 40, ((ANCHO - 24) * this.xp) / xpParaNivel(this.nivel), 12);
    ctx.fillStyle = '#f2f4ff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(`Nv ${this.nivel}`, 16, 46.5);

    ctx.translate(0, HUD);
    // Suelo y rocas
    for (let f = 0; f < FILAS; f++) {
      for (let c = 0; c < COLUMNAS; c++) {
        ctx.fillStyle = (f + c) % 2 ? '#1b2547' : '#1f2a50';
        ctx.fillRect(c * CELDA, f * CELDA, CELDA, CELDA);
        if (this.sala.rocas[f * COLUMNAS + c]) {
          ctx.fillStyle = '#4a5578';
          ctx.fillRect(c * CELDA + 2, f * CELDA + 2, CELDA - 4, CELDA - 4);
          ctx.fillStyle = '#5d6a93';
          ctx.fillRect(c * CELDA + 2, f * CELDA + 2, CELDA - 4, 8);
        }
      }
    }
    // Puerta
    ctx.fillStyle = this.puertaAbierta ? '#ffcf4a' : '#3a2a1a';
    ctx.fillRect(PUERTA.col * CELDA + 4, 0, CELDA - 8, 8);
    if (this.puertaAbierta) {
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(this.tiempo * 6);
      ctx.fillRect(PUERTA.col * CELDA, 0, CELDA, CELDA);
      ctx.globalAlpha = 1;
    }

    if (this.angel && !this.angel.usado) {
      ctx.font = '34px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👼', this.angel.x, this.angel.y + Math.sin(this.tiempo * 3) * 4);
      ctx.textAlign = 'left';
    }

    for (const r of this.recogibles) {
      ctx.fillStyle = r.tipo === 'oro' ? '#ffcf4a' : '#4ad1ff';
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.tipo === 'oro' ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const e of this.enemigos) this.dibujarEnemigo(ctx, e);

    // Flechas
    ctx.strokeStyle = this.stats.fuego ? '#ff9a3d' : this.stats.hielo ? '#9fe8ff' : this.stats.veneno ? '#9dff6b' : '#fff6d0';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (const f of this.flechas) {
      const l = Math.hypot(f.vx, f.vy) || 1;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(f.x - (f.vx / l) * 12, f.y - (f.vy / l) * 12);
      ctx.stroke();
    }
    ctx.fillStyle = '#ff4a6e';
    for (const b of this.balas) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    this.dibujarJugador(ctx);

    for (const p of this.particulas) {
      ctx.globalAlpha = Math.min(1, p.vida * 3);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private dibujarJugador(ctx: CanvasRenderingContext2D) {
    const j = this.jugador;
    if (j.invul > 0 && Math.floor(j.invul * 20) % 2) ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#ffcf4a';
    ctx.beginPath();
    ctx.arc(j.x, j.y, j.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1300';
    const l = Math.hypot(j.dirX, j.dirY) || 1;
    ctx.beginPath();
    ctx.arc(j.x + (j.dirX / l) * 5, j.y + (j.dirY / l) * 5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    for (let i = 0; i < this.stats.orbes; i++) {
      const a = this.tiempo * 3 + (i * Math.PI * 2) / this.stats.orbes;
      ctx.fillStyle = '#c08bff';
      ctx.beginPath();
      ctx.arc(j.x + Math.cos(a) * 42, j.y + Math.sin(a) * 42, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Barra de vida sobre el arquero.
    const w = 40;
    ctx.fillStyle = '#000a';
    ctx.fillRect(j.x - w / 2, j.y - j.r - 12, w, 5);
    ctx.fillStyle = '#58e07a';
    ctx.fillRect(j.x - w / 2, j.y - j.r - 12, (w * this.vida) / this.stats.vidaMax, 5);
  }

  private dibujarEnemigo(ctx: CanvasRenderingContext2D, e: Enemigo) {
    ctx.globalAlpha = e.tipo === 'fantasma' ? 0.6 : 1;
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : e.lento > 0 ? '#9fe8ff' : COLOR[e.tipo];
    ctx.beginPath();
    if (e.tipo === 'torreta' || e.tipo === 'tortuga') ctx.rect(e.x - e.r, e.y - e.r, e.r * 2, e.r * 2);
    else ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
    if (e.tipo === 'murcielago') {
      const ala = Math.sin(this.tiempo * 18) * 4;
      ctx.fillRect(e.x - e.r - 8, e.y - 3 + ala, 8, 4);
      ctx.fillRect(e.x + e.r, e.y - 3 + ala, 8, 4);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#111';
    ctx.fillRect(e.x - e.r * 0.45, e.y - e.r * 0.25, 3, 3);
    ctx.fillRect(e.x + e.r * 0.45 - 3, e.y - e.r * 0.25, 3, 3);
    if (e.vida < e.vidaMax) {
      const w = e.tipo === 'jefe' ? 80 : e.r * 2;
      ctx.fillStyle = '#000a';
      ctx.fillRect(e.x - w / 2, e.y - e.r - 8, w, 4);
      ctx.fillStyle = '#ff5a5a';
      ctx.fillRect(e.x - w / 2, e.y - e.r - 8, (w * Math.max(0, e.vida)) / e.vidaMax, 4);
    }
  }
}

