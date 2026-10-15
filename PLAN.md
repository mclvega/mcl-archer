# Plan: juego de arquero roguelite de navegador inspirado en Archero

Nombre provisional: **McL Archer**. Stack: Vite + TypeScript, Canvas 2D, despliegue en Netlify.

---

## 1. Juego de referencia

**Archero** (Habby, 2019) y sus clones ".io". Es un roguelite de acción vista desde arriba.

**Bucle principal:**
1. El jugador se mueve con un joystick. **Al quedarse quieto, dispara automáticamente** al enemigo más cercano. Esta es la mecánica clave.
2. Cada sala tiene enemigos. Al limpiarla se abre la puerta a la siguiente.
3. Al subir de nivel, el jugador elige **1 de 3 habilidades** al azar: multidisparo, flecha frontal +1, rebote, perforación, flechas diagonales, elemento (fuego, hielo o veneno), escudo de orbes, más vida, más velocidad de ataque, etc.
4. Cada 5 salas hay un ángel (cura o habilidad) y cada 10, un jefe.
5. Si el jugador muere, pierde la partida. Lo que gana (oro) sirve para mejoras permanentes.

**Qué copiamos y qué cambiamos:**

| Copiamos | Cambiamos |
|---|---|
| Moverse para esquivar y quedarse quieto para disparar | Sin energía, anuncios ni compras |
| Elegir 1 de 3 habilidades | Salas generadas por algoritmo, sin límite (modo infinito) |
| Jefes cada 10 salas | Partidas de unos 10 minutos |
| Mejoras permanentes con oro | Se juega con el ratón o el teclado además del táctil |

---

## 2. Alcance del MVP

- 1 capítulo de 30 salas más un modo infinito.
- 8 enemigos: murciélago que embiste, mago que dispara en abanico, slime que se divide, arquero, tortuga con escudo, torreta, fantasma que atraviesa paredes y bomba.
- 3 jefes.
- 20 habilidades que se pueden combinar.
- Mejoras permanentes: ataque, vida y velocidad.
- Pantalla completa por defecto, configuración y récords locales.

---

## 3. Arquitectura

```
src/
  main.ts, app.ts       arranque, pantallas, pantalla completa y guardado
  core/
    loop.ts             paso fijo
    input.ts            joystick táctil flotante, WASD y mando
    collision.ts        círculos contra círculos y círculos contra muros (grid)
    rng.ts              semilla por partida
  game/
    run.ts              estado de la partida: sala actual, nivel, XP y habilidades
    room.ts             generación de la sala: plantillas + obstáculos + oleada según la profundidad
    player.ts           auto-apuntado al más cercano con línea de visión
    projectiles.ts      flechas con modificadores (rebote, perforación, división, elemento)
    skills.ts           catálogo de habilidades, con pesos y reglas de exclusión
    enemies/*.ts        IA por patrones (perseguir, orbitar, disparar en patrón)
    bosses/*.ts
    pickups.ts          XP, oro y corazones con imán
  fx/, audio.ts
  ui/                   inicio, mejoras, juego (HUD + elegir habilidad), pausa, fin y configuración
  storage.ts            oro, mejoras, récords y configuración
tests/                  skills (combinación de modificadores), generación de salas, colisiones y storage
```

**Decisiones:**
- Cada habilidad es un modificador de datos que se aplica a las estadísticas o a los proyectiles, no lógica escrita a mano en cada sitio.
- La dificultad escala con la profundidad: vida, daño y densidad de enemigos.
- Se usa *pooling* de proyectiles, porque una partida avanzada puede tener cientos.

---

## 4. Fases

1. **Base**: bucle, joystick, movimiento, muros y auto-disparo.
2. **Combate**: 3 enemigos, daño, XP y la pantalla para elegir habilidad (con 8 habilidades).
3. **Progresión**: salas encadenadas, puertas, ángel y el primer jefe.
4. **Contenido**: el resto de los enemigos, jefes y habilidades, más el modo infinito.
5. **Meta**: oro, mejoras permanentes y récords.
6. **Pulido**: efectos, audio, balance, PWA y Netlify.

**Criterios de aceptación:** 60 FPS con más de 200 proyectiles en un móvil de gama media, capítulo 1 completable y tests en verde.
