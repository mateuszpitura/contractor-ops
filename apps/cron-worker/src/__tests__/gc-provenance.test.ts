import { describe, it } from 'vitest';

describe('Reminders cron — IdpChangeProvenance GC sub-task (Phase 76 D-12)', () => {
  it.todo('reminders handler calls gcExpiredProvenance(db) once per invocation');
  it.todo('logs structured pino entry with deleted count after GC runs');
  it.todo('GC failure does not abort other reminder sub-tasks (isolated try/catch)');
});
