import { APIResource } from "../../../../core/resource.mjs";
import { PageCursor } from "../../../../core/pagination.mjs";
export class Users extends APIResource {
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
        return this._client.getAPIList('/v1/organizations/analytics/users?beta=true', (PageCursor), { query, ...options });
    }
}
//# sourceMappingURL=users.mjs.map