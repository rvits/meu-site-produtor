export const ADMIN_AUDIT_PROFILE_UPDATE = "profile_update";

export function adminAuditActorLabel(nomeArtistico: string | null | undefined): string {
  const name = String(nomeArtistico ?? "").trim();
  return name || "Administrador removido";
}

export function buildAdminAuditEntry(input: {
  adminId: string;
  targetUserId: string;
  action: string;
  field?: string | null;
}) {
  return {
    adminId: input.adminId,
    targetUserId: input.targetUserId,
    action: input.action,
    field: input.field ?? null,
  };
}
