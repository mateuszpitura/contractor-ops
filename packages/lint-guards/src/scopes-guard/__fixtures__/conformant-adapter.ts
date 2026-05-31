// Test fixture — a conformant Deprovisionable adapter.
// Every write-capable scope is traced to a same-file `as const` typed-const.

const FAKE_DEPROVISION_SCOPES = ['https://example.com/api/admin.directory.user'] as const;

export class ConformantAdapter {
  getOAuthConfig() {
    return {
      scopes: [...FAKE_DEPROVISION_SCOPES, 'https://example.com/api/admin.directory.user.readonly'],
    };
  }
}
