export function buildContactIdentityFilters(email?: string | null, phone?: string | null) {
  if (email) return [{ email }];
  if (phone) return [{ phone }];
  return [];
}
