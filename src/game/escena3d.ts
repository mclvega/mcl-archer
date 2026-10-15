import * as THREE from 'three';
import { CELDA, COLUMNAS, FILAS, PUERTA, type Sala, type TipoEnemigo } from '../core/room';
import { animateWalk, createAvatar, DEFAULT_LOOK, type Look } from './characters';
import type { Enemigo, Partida } from './run';

/** Píxeles del mundo por unidad 3D (una celda = 1 unidad). */
const U = CELDA;
const ANGULO = (58 * Math.PI) / 180;
const ESCALA_PERSONAJE = 0.82;
/** Margen para que se vean los muretes laterales. */
const ZOOM = (COLUMNAS + 0.8) / COLUMNAS;

const cacheMat = new Map<string, THREE.Material>();
function mat(color: number, opciones: { basico?: boolean; opacidad?: number; emisivo?: number } = {}): THREE.Material {
  const clave = `${color}|${opciones.basico ?? false}|${opciones.opacidad ?? 1}|${opciones.emisivo ?? 0}`;
  let m = cacheMat.get(clave);
  if (!m) {
    const comun = { color, transparent: (opciones.opacidad ?? 1) < 1, opacity: opciones.opacidad ?? 1 };
    m = opciones.basico ? new THREE.MeshBasicMaterial(comun) : new THREE.MeshLambertMaterial({ ...comun, emissive: opciones.emisivo ?? 0 });
    cacheMat.set(clave, m);
  }
  return m;
}

function malla(geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** Arco de madera que se sujeta en la mano derecha del avatar. */
function arco(): THREE.Group {
  const g = new THREE.Group();
  const madera = malla(new THREE.TorusGeometry(0.22, 0.025, 6, 16, Math.PI), mat(0x8d5524));
  madera.rotation.z = -Math.PI / 2;
  const cuerda = malla(new THREE.CylinderGeometry(0.006, 0.006, 0.44, 4), mat(0xf5f5f5));
  g.add(madera, cuerda);
  g.position.set(0, -0.38, 0.06);
  g.rotation.x = Math.PI / 2;
  return g;
}

function conArco(personaje: THREE.Group, cuerpo: THREE.Group): THREE.Group {
  const brazos = cuerpo.userData.arms as THREE.Object3D[] | undefined;
  brazos?.[1]?.add(arco());
  return personaje;
}

/** Modelos low-poly de cada enemigo, al estilo de los personajes del Arcade. */
function crearModelo(tipo: TipoEnemigo, mini: boolean): THREE.Group {
  const g = new THREE.Group();
  const cuerpo = new THREE.Group();
  g.add(cuerpo);
  g.userData.cuerpo = cuerpo;
  const ojos = (y: number, z: number, sep = 0.09, r = 0.04) => {
    for (const x of [-sep, sep]) {
      cuerpo.add(malla(new THREE.SphereGeometry(r, 8, 6), mat(0xffffff), x, y, z));
      cuerpo.add(malla(new THREE.SphereGeometry(r * 0.55, 6, 4), mat(0x111111), x, y, z + r * 0.6));
    }
  };
  switch (tipo) {
    case 'murcielago': {
      cuerpo.add(malla(new THREE.SphereGeometry(0.2, 12, 10), mat(0x5e35b1), 0, 0.7, 0));
      for (const lado of [-1, 1]) {
        const ala = malla(new THREE.ConeGeometry(0.16, 0.42, 3), mat(0x311b92), lado * 0.3, 0.72, 0);
        ala.rotation.z = (lado * Math.PI) / 2;
        cuerpo.add(ala);
        (g.userData.alas ??= []).push(ala);
      }
      for (const x of [-0.08, 0.08]) cuerpo.add(malla(new THREE.ConeGeometry(0.05, 0.12, 4), mat(0x311b92), x, 0.92, 0));
      ojos(0.74, 0.16, 0.07, 0.035);
      break;
    }
    case 'slime': {
      const gota = malla(new THREE.SphereGeometry(0.34, 16, 12), mat(0x43c463, { opacidad: 0.85 }), 0, 0.26, 0);
      gota.scale.set(1, 0.75, 1);
      cuerpo.add(gota);
      ojos(0.36, 0.26);
      break;
    }
    case 'fantasma': {
      cuerpo.add(malla(new THREE.SphereGeometry(0.3, 14, 10), mat(0xe3f2fd, { opacidad: 0.6 }), 0, 0.9, 0));
      const cola = malla(new THREE.ConeGeometry(0.3, 0.55, 14, 1, true), mat(0xe3f2fd, { opacidad: 0.6 }), 0, 0.55, 0);
      cola.rotation.x = Math.PI;
      cuerpo.add(cola);
      for (const x of [-0.1, 0.1]) cuerpo.add(malla(new THREE.SphereGeometry(0.05, 8, 6), mat(0x1a237e), x, 0.95, 0.26));
      break;
    }
    case 'tortuga': {
      const caparazon = malla(new THREE.SphereGeometry(0.42, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x2e7d5b), 0, 0.12, 0);
      caparazon.scale.set(1, 0.8, 1.1);
      cuerpo.add(caparazon);
      cuerpo.add(malla(new THREE.CylinderGeometry(0.43, 0.43, 0.08, 14), mat(0xc8a96a), 0, 0.12, 0));
      cuerpo.add(malla(new THREE.SphereGeometry(0.16, 10, 8), mat(0x7cb342), 0, 0.25, 0.5));
      for (const x of [-0.06, 0.06]) cuerpo.add(malla(new THREE.SphereGeometry(0.03, 6, 4), mat(0x111111), x, 0.3, 0.63));
      break;
    }
    case 'torreta': {
      cuerpo.add(malla(new THREE.CylinderGeometry(0.36, 0.42, 0.4, 10), mat(0x607d8b), 0, 0.2, 0));
      const cabeza = new THREE.Group();
      cabeza.position.y = 0.55;
      cabeza.add(malla(new THREE.SphereGeometry(0.26, 12, 10), mat(0x90a4ae)));
      cabeza.add(malla(new THREE.BoxGeometry(0.1, 0.1, 0.4), mat(0x37474f), 0, 0, 0.3));
      cabeza.add(malla(new THREE.SphereGeometry(0.06, 8, 6), mat(0xff1744, { basico: true }), 0, 0.1, 0.2));
      cuerpo.add(cabeza);
      break;
    }
    case 'bomba': {
      cuerpo.add(malla(new THREE.SphereGeometry(0.26, 14, 10), mat(0x263238), 0, 0.3, 0));
      cuerpo.add(malla(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 6), mat(0x8d6e63), 0, 0.6, 0));
      const chispa = malla(new THREE.SphereGeometry(0.06, 6, 4), mat(0xffab00, { basico: true }), 0, 0.7, 0);
      cuerpo.add(chispa);
      g.userData.chispa = chispa;
      ojos(0.36, 0.22, 0.08, 0.035);
      break;
    }
    case 'mago': {
      const a = createAvatar({ ...DEFAULT_LOOK, shirt: 0x8e24aa, bottom: 'skirt', bottomColor: 0x4a148c, hair: 'long', hairColor: 0xbdbdbd, facialHair: 'beard', hat: 'none', skin: 0xe0ac69 });
      a.body.add(malla(new THREE.ConeGeometry(0.26, 0.5, 12), mat(0x6a1b9a), 0, 1.65, 0));
      a.body.add(malla(new THREE.SphereGeometry(0.08, 8, 6), mat(0xff6bd5, { basico: true }), 0.38, 0.5, 0.15));
      a.group.scale.setScalar(ESCALA_PERSONAJE);
      g.userData.avatar = a.body;
      g.add(a.group);
      break;
    }
    case 'arquero': {
      const a = createAvatar({ ...DEFAULT_LOOK, shirt: 0xe6a04b, bottomColor: 0x6d4c41, hat: 'cap', hatColor: 0x5d4037, facialHair: 'stubble', hair: 'short', hairColor: 0x2b1d14 });
      conArco(a.group, a.body);
      a.group.scale.setScalar(ESCALA_PERSONAJE * 0.95);
      g.userData.avatar = a.body;
      g.add(a.group);
      break;
    }
    case 'jefe': {
      const a = createAvatar({ ...DEFAULT_LOOK, body: 'chubby', height: 'tall', shirt: 0xc62828, bottomColor: 0x212121, hat: 'crown', facialHair: 'beard', hairColor: 0x212121, accessory: 'scarf', skin: 0xc68642 });
      a.group.scale.setScalar(1.45);
      g.userData.avatar = a.body;
      g.add(a.group);
      break;
    }
  }
  if (mini) g.scale.setScalar(0.65);
  return g;
}

/** Conjunto de mallas reutilizables (flechas, balas, partículas...). */
class Reserva {
  private lista: THREE.Object3D[] = [];
  private usadas = 0;
  constructor(private padre: THREE.Object3D, private crear: () => THREE.Object3D) {}
  inicio() {
    this.usadas = 0;
  }
  tomar(): THREE.Object3D {
    if (this.usadas >= this.lista.length) {
      const o = this.crear();
      this.lista.push(o);
      this.padre.add(o);
    }
    const o = this.lista[this.usadas++];
    o.visible = true;
    return o;
  }
  fin() {
    for (let i = this.usadas; i < this.lista.length; i++) this.lista[i].visible = false;
  }
}

export class Escena3D {
  readonly renderer: THREE.WebGLRenderer;
  private escena = new THREE.Scene();
  private camara: THREE.OrthographicCamera;
  private objetivo = new THREE.Vector3();
  private sala = new THREE.Group();
  private salaActual = -1;
  private puerta!: THREE.Mesh;
  private jugador!: { group: THREE.Group; body: THREE.Group };
  private lookActual = '';
  private orbes: THREE.Mesh[] = [];
  private angel: THREE.Group;
  private modelos = new Map<Enemigo, THREE.Group>();
  private flechas: Reserva;
  private balas: Reserva;
  private recogibles: Reserva;
  private particulas: Reserva;
  private vector = new THREE.Vector3();

  constructor(lienzo: HTMLCanvasElement, private ancho: number, private alto: number) {
    this.renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.escena.background = new THREE.Color(0x000000);

    const unidadesAncho = (ancho / U) * ZOOM;
    const unidadesAlto = (alto / U) * ZOOM;
    this.camara = new THREE.OrthographicCamera(-unidadesAncho / 2, unidadesAncho / 2, unidadesAlto / 2, -unidadesAlto / 2, 0.1, 100);
    // La sala se ve inclinada; se desplaza el centro para dejar sitio a las cabezas de la fila del fondo.
    this.objetivo.set(COLUMNAS / 2, 0, FILAS / 2 - 0.75);
    this.colocarCamara(0, 0);

    this.escena.add(new THREE.HemisphereLight(0xffffff, 0x445577, 1.5));
    const sol = new THREE.DirectionalLight(0xffffff, 1.6);
    sol.position.set(COLUMNAS / 2 - 4, 12, FILAS / 2 + 5);
    sol.target.position.set(COLUMNAS / 2, 0, FILAS / 2);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    Object.assign(sol.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
    this.escena.add(sol, sol.target, this.sala);

    this.flechas = new Reserva(this.escena, () => {
      const g = new THREE.Group();
      const asta = malla(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 5), mat(0xfff6d0, { basico: true }));
      asta.rotation.x = Math.PI / 2;
      const punta = malla(new THREE.ConeGeometry(0.05, 0.1, 5), mat(0xb0bec5), 0, 0, 0.24);
      punta.rotation.x = Math.PI / 2;
      g.add(asta, punta);
      return g;
    });
    this.balas = new Reserva(this.escena, () => malla(new THREE.SphereGeometry(0.12, 10, 8), mat(0xff4a6e, { basico: true })));
    this.recogibles = new Reserva(this.escena, () => malla(new THREE.OctahedronGeometry(0.09), mat(0x4ad1ff, { basico: true })));
    this.particulas = new Reserva(this.escena, () => malla(new THREE.BoxGeometry(0.08, 0.08, 0.08), mat(0xffffff, { basico: true })));

    this.angel = new THREE.Group();
    const a = createAvatar({ ...DEFAULT_LOOK, gender: 'girl', shirt: 0xffffff, bottom: 'skirt', bottomColor: 0xffffff, hair: 'long', hairColor: 0xf6d36b, hat: 'none', eyes: 'happy' });
    a.group.scale.setScalar(ESCALA_PERSONAJE);
    for (const lado of [-1, 1]) {
      const ala = malla(new THREE.SphereGeometry(0.3, 10, 8), mat(0xffffff, { opacidad: 0.85 }), lado * 0.32, 1.0, -0.18);
      ala.scale.set(0.5, 1, 0.2);
      a.body.add(ala);
    }
    const aureola = malla(new THREE.TorusGeometry(0.18, 0.03, 6, 20), mat(0xffd54f, { basico: true }), 0, 1.72, 0);
    aureola.rotation.x = Math.PI / 2;
    a.body.add(aureola);
    this.angel.add(a.group);
    this.escena.add(this.angel);
  }

  private colocarCamara(dx: number, dz: number) {
    const dir = new THREE.Vector3(0, Math.sin(ANGULO), Math.cos(ANGULO));
    this.camara.position.copy(this.objetivo).addScaledVector(dir, 30).add(new THREE.Vector3(dx, 0, dz));
    this.camara.lookAt(this.objetivo.x + dx, 0, this.objetivo.z + dz);
    this.camara.updateMatrixWorld();
  }

  ajustar(anchoCss: number, altoCss: number, dpr: number) {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(anchoCss, altoCss, false);
  }

  /** Punto del mundo (píxeles) a coordenadas de la sala en el lienzo lógico. */
  proyectar = (x: number, y: number, altura: number) => {
    this.vector.set(x / U, altura, y / U).project(this.camara);
    return { x: ((this.vector.x + 1) / 2) * this.ancho, y: ((1 - this.vector.y) / 2) * this.alto };
  };

  private construirSala(sala: Sala) {
    this.sala.clear();
    const piso = new THREE.BoxGeometry(1, 0.2, 1);
    for (let f = 0; f < FILAS; f++) {
      for (let c = 0; c < COLUMNAS; c++) {
        const baldosa = new THREE.Mesh(piso, mat((f + c) % 2 ? 0x2b3a6b : 0x324477));
        baldosa.position.set(c + 0.5, -0.1, f + 0.5);
        baldosa.receiveShadow = true;
        this.sala.add(baldosa);
        if (sala.rocas[f * COLUMNAS + c]) {
          const roca = malla(new THREE.DodecahedronGeometry(0.5, 0), mat(0x6d7896), c + 0.5, 0.32, f + 0.5);
          roca.scale.set(1, 0.75, 1);
          roca.rotation.y = (c * 7 + f * 13) % 6;
          roca.receiveShadow = true;
          this.sala.add(roca);
          this.sala.add(malla(new THREE.DodecahedronGeometry(0.2, 0), mat(0x8590ad), c + 0.75, 0.72, f + 0.35));
        }
      }
    }
    // Muretes alrededor de la sala.
    const muro = mat(0x1b2547);
    for (const [x, z, w, d] of [[COLUMNAS / 2, -0.15, COLUMNAS + 0.6, 0.3], [COLUMNAS / 2, FILAS + 0.15, COLUMNAS + 0.6, 0.3], [-0.15, FILAS / 2, 0.3, FILAS], [COLUMNAS + 0.15, FILAS / 2, 0.3, FILAS]]) {
      this.sala.add(malla(new THREE.BoxGeometry(w, 0.5, d), muro, x, 0.25, z));
    }
    // Puerta
    const px = PUERTA.col + 0.5;
    for (const lado of [-0.5, 0.5]) this.sala.add(malla(new THREE.BoxGeometry(0.15, 1.2, 0.3), mat(0x5d4037), px + lado, 0.6, -0.1));
    this.sala.add(malla(new THREE.BoxGeometry(1.15, 0.15, 0.3), mat(0x5d4037), px, 1.2, -0.1));
    this.puerta = malla(new THREE.BoxGeometry(0.85, 1.1, 0.06), mat(0x3a2a1a), px, 0.55, -0.1);
    this.sala.add(this.puerta);
  }

  private modeloJugador(look: Look) {
    const clave = JSON.stringify(look);
    if (clave === this.lookActual) return;
    if (this.jugador) this.escena.remove(this.jugador.group);
    this.jugador = createAvatar(look);
    conArco(this.jugador.group, this.jugador.body);
    this.jugador.group.scale.setScalar(ESCALA_PERSONAJE);
    this.escena.add(this.jugador.group);
    this.lookActual = clave;
  }

  dibujar(p: Partida, look: Look, efectos: boolean) {
    if (p.sala.numero !== this.salaActual) {
      this.construirSala(p.sala);
      this.salaActual = p.sala.numero;
      for (const m of this.modelos.values()) this.escena.remove(m);
      this.modelos.clear();
    }
    const t = p.tiempo;
    const temblor = efectos ? p.temblor * 0.01 : 0;
    this.colocarCamara((Math.random() - 0.5) * temblor, (Math.random() - 0.5) * temblor);

    this.puerta.material = p.puertaAbierta ? mat(0xffcf4a, { basico: true, opacidad: 0.6 + 0.3 * Math.sin(t * 6) }) : mat(0x3a2a1a);

    // Jugador
    this.modeloJugador(look);
    const j = p.jugador;
    const g = this.jugador.group;
    g.position.set(j.x / U, 0, j.y / U);
    let mirarX = j.dirX;
    let mirarY = j.dirY;
    if (!j.moviendo) {
      let cerca: Enemigo | null = null;
      let d = Infinity;
      for (const e of p.enemigos) {
        const de = (e.x - j.x) ** 2 + (e.y - j.y) ** 2;
        if (de < d) {
          d = de;
          cerca = e;
        }
      }
      if (cerca) {
        mirarX = cerca.x - j.x;
        mirarY = cerca.y - j.y;
      }
    }
    g.rotation.y = Math.atan2(mirarX, mirarY);
    animateWalk(this.jugador.body, t, j.moviendo);
    const brazos = this.jugador.body.userData.arms as THREE.Object3D[];
    if (!j.moviendo && p.enemigos.length) brazos[1].rotation.x = -Math.PI / 2; // apuntando con el arco
    g.visible = !(j.invul > 0 && Math.floor(j.invul * 20) % 2);

    // Orbes guardianes
    while (this.orbes.length < p.stats.orbes) {
      const o = malla(new THREE.SphereGeometry(0.15, 12, 10), mat(0xc08bff, { emisivo: 0x5e35b1 }));
      this.orbes.push(o);
      this.escena.add(o);
    }
    this.orbes.forEach((o, i) => {
      o.visible = i < p.stats.orbes;
      const a = t * 3 + (i * Math.PI * 2) / Math.max(1, p.stats.orbes);
      o.position.set((j.x + Math.cos(a) * 42) / U, 0.55, (j.y + Math.sin(a) * 42) / U);
    });

    // Ángel
    this.angel.visible = !!p.angel && !p.angel.usado;
    if (p.angel) {
      this.angel.position.set(p.angel.x / U, 0.2 + Math.sin(t * 3) * 0.1, p.angel.y / U);
      this.angel.rotation.y = Math.sin(t) * 0.4;
    }

    // Enemigos
    const vivos = new Set(p.enemigos);
    for (const [e, m] of this.modelos) {
      if (!vivos.has(e)) {
        this.escena.remove(m);
        this.modelos.delete(e);
      }
    }
    for (const e of p.enemigos) {
      let m = this.modelos.get(e);
      if (!m) {
        m = crearModelo(e.tipo, !!e.mini);
        this.modelos.set(e, m);
        this.escena.add(m);
      }
      m.position.set(e.x / U, 0, e.y / U);
      m.rotation.y = Math.atan2(j.x - e.x, j.y - e.y);
      const base = (e.mini ? 0.65 : 1) * (m.userData.avatar ? 1 : 1.25);
      m.scale.setScalar(base * (e.flash > 0 ? 1.18 : 1));
      const cuerpo = m.userData.cuerpo as THREE.Group;
      if (e.tipo === 'murcielago') {
        cuerpo.position.y = Math.sin(t * 4 + e.x) * 0.08;
        (m.userData.alas as THREE.Mesh[]).forEach((a, i) => (a.rotation.x = Math.sin(t * 20) * (i ? 0.6 : -0.6)));
      } else if (e.tipo === 'slime') {
        cuerpo.scale.set(1 + Math.sin(t * 6 + e.y) * 0.08, 1 - Math.sin(t * 6 + e.y) * 0.08, 1);
      } else if (e.tipo === 'fantasma') {
        cuerpo.position.y = Math.sin(t * 2 + e.x) * 0.1;
      } else if (e.tipo === 'bomba') {
        (m.userData.chispa as THREE.Mesh).visible = Math.floor(t * 10) % 2 === 0;
      }
      if (m.userData.avatar) animateWalk(m.userData.avatar as THREE.Group, t + e.x, e.tipo !== 'arquero');
      if (e.lento > 0) cuerpo.position.y = 0;
    }

    // Flechas, balas, recogibles y partículas
    const colorFlecha = p.stats.fuego ? 0xff9a3d : p.stats.hielo ? 0x9fe8ff : p.stats.veneno ? 0x9dff6b : 0xfff6d0;
    this.flechas.inicio();
    for (const f of p.flechas) {
      const o = this.flechas.tomar();
      o.position.set(f.x / U, 0.5, f.y / U);
      o.rotation.y = Math.atan2(f.vx, f.vy);
      (o.children[0] as THREE.Mesh).material = mat(colorFlecha, { basico: true });
    }
    this.flechas.fin();

    this.balas.inicio();
    for (const b of p.balas) this.balas.tomar().position.set(b.x / U, 0.45, b.y / U);
    this.balas.fin();

    this.recogibles.inicio();
    for (const r of p.recogibles) {
      const o = this.recogibles.tomar() as THREE.Mesh;
      o.position.set(r.x / U, 0.25 + Math.sin(t * 5 + r.x) * 0.05, r.y / U);
      o.rotation.y = t * 4;
      o.material = mat(r.tipo === 'oro' ? 0xffcf4a : 0x4ad1ff, { basico: true });
      o.scale.setScalar(r.tipo === 'oro' ? 1.3 : 1);
    }
    this.recogibles.fin();

    this.particulas.inicio();
    for (const q of p.particulas) {
      const o = this.particulas.tomar() as THREE.Mesh;
      o.position.set(q.x / U, 0.4 + (0.6 - q.vida) * 0.8, q.y / U);
      o.material = mat(new THREE.Color(q.color).getHex(), { basico: true });
      o.scale.setScalar(Math.max(0.2, q.vida * 2));
    }
    this.particulas.fin();

    this.renderer.render(this.escena, this.camara);
  }
}
