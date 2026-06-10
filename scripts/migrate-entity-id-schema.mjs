#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const files = [
  'packages/api/src/routers/core/admin-boe-rate.ts',
  'packages/api/src/routers/core/api-key.ts',
  'packages/api/src/routers/core/approval.ts',
  'packages/api/src/routers/core/contract.ts',
  'packages/api/src/routers/core/contractor.ts',
  'packages/api/src/routers/core/cost-center.ts',
  'packages/api/src/routers/core/project.ts',
  'packages/api/src/routers/core/reminder.ts',
  'packages/api/src/routers/core/team.ts',
  'packages/api/src/routers/equipment/equipment-shipments.ts',
  'packages/api/src/routers/equipment/equipment.ts',
  'packages/api/src/routers/finance/invoice.ts',
  'packages/api/src/routers/integrations/jira.ts',
  'packages/api/src/routers/portal/portal-contracts-router.ts',
  'packages/api/src/routers/portal/portal-equipment-router.ts',
  'packages/api/src/routers/portal/portal-invoices-router.ts',
  'packages/api/src/routers/public-api/contract.ts',
  'packages/api/src/routers/public-api/contractor.ts',
  'packages/api/src/routers/public-api/document.ts',
  'packages/api/src/routers/workflow/credential-reference.ts',
  'packages/api/src/routers/workflow/workflow-execution.ts',
  'packages/api/src/routers/workflow/workflow-roles.ts',
  'packages/api/src/routers/workflow/workflow-templates.ts',
];

const pattern =
  /\.input\(z\.object\(\{\s*id:\s*z\.string\(\)(?:\.min\(1\))?\s*\}\)\)/g;

for (const file of files) {
  let content = readFileSync(file, 'utf8');
  const before = content;
  content = content.replace(pattern, '.input(entityIdSchema)');
  if (content === before) continue;

  if (!content.includes('entityIdSchema')) {
    const validatorsImport = /import \{([^}]+)\} from '@contractor-ops\/validators'/;
    if (validatorsImport.test(content)) {
      content = content.replace(validatorsImport, (match, inner) => {
        if (inner.includes('entityIdSchema')) return match;
        return `import { entityIdSchema, ${inner.trim()}} from '@contractor-ops/validators'`;
      });
    } else {
      content = `import { entityIdSchema } from '@contractor-ops/validators';\n${content}`;
    }
  }

  writeFileSync(file, content);
  console.log('updated', file);
}
