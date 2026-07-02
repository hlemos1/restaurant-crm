import { db } from "@/db";
import { tenants, tenantUsers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  parentId: string | null;
}

/**
 * Resolve tenant from slug (used in middleware/auth)
 */
export async function getTenantBySlug(slug: string) {
  const result = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.slug, slug), eq(tenants.active, true)))
    .limit(1);
  return result[0] ?? null;
}

/**
 * Resolve tenant from custom domain
 */
export async function getTenantByDomain(domain: string) {
  const result = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.customDomain, domain), eq(tenants.active, true)))
    .limit(1);
  return result[0] ?? null;
}

/**
 * Get the first tenant a user belongs to (for login flow)
 */
export async function getDefaultTenantForUser(userId: string) {
  const result = await db
    .select({
      tenantId: tenants.id,
      tenantSlug: tenants.slug,
      tenantName: tenants.name,
      parentId: tenants.parentId,
      role: tenantUsers.role,
    })
    .from(tenantUsers)
    .innerJoin(tenants, eq(tenantUsers.tenantId, tenants.id))
    .where(and(eq(tenantUsers.userId, userId), eq(tenants.active, true)))
    .limit(1);
  return result[0] ?? null;
}

/**
 * Get all tenants a user has access to
 */
export async function getTenantsForUser(userId: string) {
  return db
    .select({
      tenantId: tenants.id,
      tenantSlug: tenants.slug,
      tenantName: tenants.name,
      parentId: tenants.parentId,
      role: tenantUsers.role,
      logo: tenants.logo,
      primaryColor: tenants.primaryColor,
    })
    .from(tenantUsers)
    .innerJoin(tenants, eq(tenantUsers.tenantId, tenants.id))
    .where(and(eq(tenantUsers.userId, userId), eq(tenants.active, true)));
}

/**
 * Get child tenants (for group-level view)
 */
export async function getChildTenants(parentId: string) {
  return db
    .select()
    .from(tenants)
    .where(and(eq(tenants.parentId, parentId), eq(tenants.active, true)));
}
