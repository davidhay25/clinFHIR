"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Projects = void 0;
const resource_1 = require("../../../../../../core/resource.js");
const pagination_1 = require("../../../../../../core/pagination.js");
class Projects extends resource_1.APIResource {
    /**
     * Get per-project activity for a given day, with cursor-based pagination.
     *
     * Returns activity metrics for each project in the organization, sorted by project
     * ID. Use `group_by[]` to break projects out per member or per RBAC group, and
     * `filter[]` to scope results; the parameter descriptions list the supported
     * dimensions. Available to organizations on a Claude Enterprise plan. Requires an
     * API key with the `read:analytics` scope.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const betaAnalyticsProjectActivity of client.beta.organization.analytics.apps.chat.projects.list()) {
     *   // ...
     * }
     * ```
     */
    list(query = {}, options) {
        return this._client.getAPIList('/v1/organizations/analytics/apps/chat/projects?beta=true', (pagination_1.PageCursor), { query, ...options });
    }
}
exports.Projects = Projects;
//# sourceMappingURL=projects.js.map