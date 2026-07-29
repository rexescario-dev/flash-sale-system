import { defaultSeedStatePath } from './paths';
import { seedE2E } from './seed';

seedE2E()
  .then((state) => {
    process.stdout.write(
      `E2E seed complete → ${defaultSeedStatePath()}: ${JSON.stringify(state)}\n`,
    );
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
