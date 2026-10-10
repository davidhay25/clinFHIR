"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Users = void 0;
const resource_1 = require("../../../../core/resource.js");
const pagination_1 = require("../../../../core/pagination.js");
class Users extends resource_1.APIResource {
    /**
     * Get per-user activity for a given day, with cursor-based pagination.
     *
     * Returns activity metrics for each user in the organization, sorted by email
     * address. Use `group_by[]` for per-RBAC-group aggregates, or `filter[]` to scope
     * results to specific members, groups, or a chat project. Available to
     * organizations on a Claude Enterprise plan. Requires an API key with the
     * `read:analytics` scope.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const betaAnalyticsUserActivity of client.beta.organization.analytics.users.list()) {
     *   // ...
     * }
     * ```
     */
    list(query = {}, options) {
        return this._client.getAPIList('/v1/organizations/analytics/users?beta=true', (pagination_1.PageCursor), { query, ...options });
    }
}
exports.Users = Users;
//# sourceMappingURL=users.js.map