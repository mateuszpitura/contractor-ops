import * as migration20260517152937Initial from './20260517_152937_initial';

export const migrations = [
  {
    up: migration20260517152937Initial.up,
    down: migration20260517152937Initial.down,
    name: '20260517_152937_initial',
  },
];
