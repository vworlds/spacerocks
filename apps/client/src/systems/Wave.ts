import { world, updatePhase, gameState, canvasSize } from '../world';
import { Asteroid, Alien } from '../components/index';
import { createAsteroid } from '../factories/Asteroid';

const asteroidQuery = world.query('WaveAsteroids').requires(Asteroid);
const alienQuery = world.query('WaveAliens').requires(Alien);

world
  .system('Wave')
  .interval(0.25)
  .phase(updatePhase)
  .run(() => {
    if (gameState.state !== 'playing') return;
    if (asteroidQuery.count === 0 && alienQuery.count === 0) {
      gameState.wave++;
      const count = 3 + gameState.wave * 2;
      const { width, height } = canvasSize;
      for (let i = 0; i < count; i++) {
        let x: number;
        let y: number;
        do {
          x = Math.random() * width;
          y = Math.random() * height;
        } while (Math.hypot(x - width / 2, y - height / 2) < 200);
        createAsteroid(x, y, 3);
      }
    }
  });
