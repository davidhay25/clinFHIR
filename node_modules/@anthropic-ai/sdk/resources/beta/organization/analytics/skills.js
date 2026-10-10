"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Skills = void 0;
const resource_1 = require("../../../../core/resource.js");
const pagination_1 = require("../../../../core/pagination.js");
class Skills extends resource_1.APIResource {
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
        return this._client.getAPIList('/v1/organizations/analytics/skills?beta=true', (pagination_1.PageCursor), { query, ...options });
    }
}
exports.Skills = Skills;
//# sourceMappingURL=skills.js.map