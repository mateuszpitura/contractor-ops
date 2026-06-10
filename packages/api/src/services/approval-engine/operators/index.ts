// Barrel: importing this file registers all operators at module load.
// approval-engine.ts imports it for the side effect so operators are
// discoverable via the registry before any condition is evaluated.

import './compliance-critical';
// Future: import './budget-cap';
// Future: import './fraud-score';
