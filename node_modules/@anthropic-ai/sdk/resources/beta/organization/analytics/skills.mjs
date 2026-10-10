import { APIResource } from "../../../../core/resource.mjs";
import { PageCursor } from "../../../../core/pagination.mjs";
export class Skills extends APIResource {
    /**
     * Get per-skill usage for a given day, with cursor-based pagination.
     *
     * Returns skill usage metrics for the organization, sorted by skill name. Use
     * `group_by[]` to break usage out per member, per RBAC group, or per product
     * surface, and `filter[]` to scope results; the parameter descriptions list the
     * supported dimensions. Available to organizations on a Claude Enterprise plan.
     * Requires an API key with the `read:analytics` scope.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const betaAnalyticsSkillActivity of client.beta.organization.analytics.skills.list()) {
     *   // ...
     * }
     * ```
     */
    list(query = {}, options) {
        return this._client.getAPIList('/v1/organizations/analytics/skills?beta=true', (PageCursor), { query, ...options });
    }
}
//# sourceMappingURL=skills.mjs.map