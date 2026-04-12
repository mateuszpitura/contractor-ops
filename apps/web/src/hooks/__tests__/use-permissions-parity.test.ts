import { roles } from "@contractor-ops/auth";
import { describe, expect, it } from "vitest";
import { frontendRolePermissionMatrix } from "../use-permissions";

function sortedMatrix(m: Record<string, string[]>) {
  const out: Record<string, string[]> = {};
  for (const k of Object.keys(m).sort()) {
    out[k] = [...m[k]].sort();
  }
  return out;
}

describe("frontendRolePermissionMatrix", () => {
  it("matches packages/auth role statements for every role", () => {
    for (const roleName of Object.keys(roles)) {
      const front = frontendRolePermissionMatrix[roleName];
      expect(front, `missing UI matrix for role: ${roleName}`).toBeDefined();
      const backend = roles[roleName as keyof typeof roles].statements;
      expect(sortedMatrix(front as Record<string, string[]>)).toEqual(
        sortedMatrix(backend as Record<string, string[]>),
      );
    }
  });
});
