// PLAN_REF: Phase 59 Plans 59-02 + 59-04 (UI CTAs) close todos below.
import { describe } from 'vitest';

describe('ClassificationDocumentsPanel a11y (Phase 59 · WCAG AA)', () => {
  describe.todo('Generate SDS button has accessible name and role=button');
  describe.todo('Generate SDS button sets aria-disabled=true when assessment is draft');
  describe.todo('Document history list has semantic <ul> / <li> with descriptive link text');
  describe.todo('axe reports zero violations on default panel render');
  describe.todo('keyboard navigation: Tab reaches Generate and Download buttons in visible order');
});
