// Clock is a port for "now". Domain and application code depend on this
// interface instead of calling `new Date()` directly, so tests can inject a
// fixed instant instead of racing the real clock. Dates are stored in UTC;
// the user's timezone only applies at presentation time (documento-maestro
// §12).

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export function createFixedClock(instant: Date): Clock {
  return {
    now: () => instant,
  };
}
