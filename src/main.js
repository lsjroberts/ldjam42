import { range, random } from 'lodash';
import { CanvasSpace, Group, Pt, Rectangle } from 'pts';

const theme = {
  bg: '#222',
  sheep: '#eee',
  sheepForce: '#06f',
  sheepDone: '#555',
  dog: '#fe3',
  target: 'rgba(100, 200, 150, 0.1)',
};

const space = new CanvasSpace('#pts').setup({
  bgcolor: theme.bg,
  retina: true,
  resize: true,
});
const form = space.getForm();

let round = 1;
let score = 0;
let roundTime = 1000 * 3;
let scoreMultiplier = 1;
let scoreMultiplierCountdown = 0;
const scoreMultiplierTime = 300 * 1;

const chain = new Group();
let bark = false;

const sheepCount = 100;
let sheep = new Group();
let sheepForces = [];
let sheepScored = [];

range(0, sheepCount).forEach(i => {
  const x = random(100, window.innerWidth - 100);
  const y = random(100, window.innerHeight - 100);

  sheep.push(new Pt(x, y));
  sheepForces.push(new Pt(0, 0));
  sheepScored.push(false);
});

let targets = [];
targets.push(
  Rectangle.fromCenter(
    new Pt(
      random(400, window.innerWidth - 400),
      random(400, window.innerHeight - 400),
    ),
    300,
    300,
  ),
);

const separation = (ftime, shoop) => {
  const desiredSeparation = 25;
  const steer = new Pt(0, 0);
  let count = 0;

  sheep.forEach(other => {
    const dist = shoop.$subtract(other).magnitudeSq();

    if (dist > 0 && dist < desiredSeparation * desiredSeparation) {
      const diff = shoop
        .$subtract(other)
        .unit()
        .divide(dist);
      steer.add(diff);
      count++;
    }
  });

  if (count > 0) {
    shoop.div(count);
  }

  if (steer.magnitudeSq() > 0) {
    // steer.unit().multiply(maxSpeed).subtract(velocity);
  }
};

const cohesion = (ftime, shoop) => {
  let count = 0;
  const cohesion = new Pt(0, 0);
  const maxDist = 100;

  sheep.forEach(other => {
    if (shoop === other) return;

    const dist = shoop.$subtract(other).magnitudeSq();
    if (dist > 0 && dist < maxDist * maxDist) {
      cohesion.add(other);
      count++;
    }
  });

  if (count > 0) {
    cohesion.divide(count);
  }

  cohesion.multiply(ftime / 10000);

  // shoop.add(cohesion);
  // TODO: seek
};

const reset = () => {
  round += 1;
  roundTime = 1000 * 10;
  sheepScored = sheepScored.map(() => false);
  targets = [
    Rectangle.fromCenter(
      new Pt(
        random(400, window.innerWidth - 400),
        random(400 / round, window.innerHeight - 400),
      ),
      300 / round,
    ),
  ];
};

space.add({
  animate: (time, ftime) => {
    if (chain.length > 10) chain.shift();

    scoreMultiplierCountdown -= ftime;
    if (scoreMultiplierCountdown <= 0) {
      scoreMultiplierCountdown = 0;
      scoreMultiplier -= 1;
      if (scoreMultiplier <= 1) {
        scoreMultiplier = 1;
      }
      scoreMultiplierCountdown = scoreMultiplierTime;
    }

    if (sheepScored.filter(scored => !scored).length === 0) {
      score += Math.round(roundTime * 4);
      reset();
    }

    if (roundTime < 0) {
      roundTime = 0;
      score -= sheepScored.filter(scored => !scored).length * 200;
      reset();
    } else if (roundTime > 0) {
      roundTime -= ftime;
    }

    targets.forEach(target => {
      form.strokeOnly(theme.target).rect(target);
    });

    form.strokeOnly(theme.dog, 3).line(chain);
    form.fillOnly(theme.dog).point(space.pointer, 10, 'circle');

    // sheep = sheep.filter((shoop, i) => {
    //   let show = true;
    //   targets.forEach(target => {
    //     if (Rectangle.withinBound(target, shoop)) {
    //       show = false;
    //     }
    //   });
    //   sheepForces[i] = show === false ? show : sheepForces[i];
    //   return show;
    // });

    // sheepForces = sheepForces.filter(sf => sf !== false);

    sheep.forEach((shoop, i) => {
      const targetSeparationDist = 10;
      const separationDist = 30;
      const cohesionDist = 60;
      const pointerDist = 100;
      const barkDist = 200;
      const maxSpeed = 3;

      const forces = [];

      const withinTarget = targets.reduce(
        (within, target) => within || Rectangle.withinBound(target, shoop),
        false,
      );

      if (withinTarget && !sheepScored[i]) {
        sheepScored[i] = true;
        score += scoreMultiplier * 100;
        roundTime += 500;
        scoreMultiplier += 1;
        scoreMultiplierCountdown = scoreMultiplierTime;
      }

      // Decelerate
      sheepForces[i].multiply(withinTarget ? 0.9 : 0.9);

      // Pointer
      const distPointer = shoop.$subtract(space.pointer).magnitudeSq();
      if (distPointer < pointerDist * pointerDist) {
        forces.push(
          shoop
            .$subtract(space.pointer)
            .unit()
            .multiply((100 * 100) / distPointer),
        );
      }

      if (bark && distPointer < barkDist * barkDist) {
        forces.push(
          shoop
            .$subtract(space.pointer)
            .unit()
            .multiply(100),
        );
      }

      // Boundaries
      if (shoop.x < 20) forces.push(new Pt(3, 0));
      if (shoop.x > window.innerWidth - 20) forces.push(new Pt(-3, 0));
      if (shoop.y < 20) forces.push(new Pt(0, 3));
      if (shoop.y > window.innerHeight - 20) forces.push(new Pt(0, -3));

      if (sheepScored[i]) {
        const [tl, br] = targets[0];
        if (shoop.x < tl.x + 20) forces.push(new Pt(3, 0));
        if (shoop.x > br.x - 20) forces.push(new Pt(-3, 0));
        if (shoop.y < tl.y + 20) forces.push(new Pt(0, 3));
        if (shoop.y > br.y - 20) forces.push(new Pt(0, -3));
      }

      sheep.forEach(other => {
        // Separation
        const distOther = shoop.$subtract(other).magnitudeSq();
        if (
          distOther > 0 &&
          ((withinTarget &&
            distOther < targetSeparationDist * targetSeparationDist) ||
            (!withinTarget && distOther < separationDist * separationDist))
        ) {
          forces.push(
            shoop
              .$subtract(other)
              .unit()
              .multiply(1),
            // .multiply((separationDist * separationDist) / distOther),
          );
        }

        // Cohesion
        if (
          !withinTarget &&
          distOther > separationDist * separationDist &&
          distOther < cohesionDist * cohesionDist
        ) {
          forces.push(
            shoop
              .$subtract(other)
              .unit()
              .multiply(-0.08),
          );
        }
      });

      // Total
      let sum = forces.reduce((acc, force) => acc.add(force), new Pt(0, 0));

      if (!withinTarget && sum.magnitudeSq() === 0) {
        // Random
        if (random(true) > 0.99) {
          sum = new Pt(random(-5, 5, true), random(-5, 5, true));
        }
      } else if (Math.abs(sum.x) < 0.05 && Math.abs(sum.y) < 0.05) {
        // Stop
        sum = new Pt(0, 0);
      }

      sheepForces[i].add(sum);

      // if (sheepForces[i].x > maxSpeed) sheepForces[i].x = maxSpeed;
      // if (sheepForces[i].x < -maxSpeed) sheepForces[i].x = -maxSpeed;
      // if (sheepForces[i].y > maxSpeed) sheepForces[i].y = maxSpeed;
      // if (sheepForces[i].y < -maxSpeed) sheepForces[i].y = -maxSpeed;

      if (sheepForces[i].magnitude() > maxSpeed) {
        sheepForces[i].unit().multiply(maxSpeed);
      }

      if (roundTime > 0) {
        shoop.add(sheepForces[i]);
      }

      form
        .fillOnly(sheepScored[i] ? theme.sheepDone : theme.sheep)
        .point(shoop, 6, 'circle');
      form
        .strokeOnly(theme.sheepForce)
        .line([shoop, shoop.$add(sheepForces[i].$multiply(10))]);
    });

    form.font(32);
    form.text(new Pt(32, 64), `${score}`);
    form.font(24);
    form.text(
      new Pt(32, 96),
      `Round ${round} : ${Math.round(roundTime / 100) / 10}s`,
    );

    form.font(16 + scoreMultiplier);
    form.text(
      new Pt(space.pointer.x + 16, space.pointer.y + 5),
      `x${scoreMultiplier}`,
    );

    bark = false;
  },

  action: (type, px, py) => {
    if (type === 'down') {
      bark = true;
    }

    if (type === 'up') {
      bark = false;
    }

    if (type === 'move') {
      chain.push(new Pt(px, py));
    }
  },
});

space
  .bindMouse()
  .bindTouch()
  .play();
