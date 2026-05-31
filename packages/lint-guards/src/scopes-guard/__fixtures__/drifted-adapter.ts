// Test fixture — a drifted adapter. The write-capable scope literal is inlined
// directly into getOAuthConfig().scopes and is NOT in any typed-const → offence.

export class DriftedAdapter {
  getOAuthConfig() {
    return {
      scopes: [
        'https://example.com/api/admin.directory.user', // drift — not traced to a typed-const
        'https://example.com/api/admin.directory.user.readonly',
      ],
    };
  }
}
