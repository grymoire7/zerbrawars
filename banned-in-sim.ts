// tsconfig.sim.json maps `three` to this file. Importing three from src/sim
// therefore fails typecheck with the error below.
export const banned: never = "three.js must not be imported from src/sim";
