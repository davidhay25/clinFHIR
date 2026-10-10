import { APIResource } from "../../../../core/resource.mjs";
import { PageCursor } from "../../../../core/pagination.mjs";
export class UserUsageReport extends APIResource {
    /**
     * Get per-user token usage across a date range.
     *
     * Returns one row per user, ranked by the chosen token metric. Use this to see
     * which users consume the most tokens. Only usage attributable to a seat user is
     * included; for organization-wide totals including direct API-key and automation
     * traffic, use the bucketed `/v1/organizations/analytics/usage_report` endpoint.
     * Available to organizations on a Claude Enterprise plan. Requires an API key with
     * the `read:analytics` scope.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const betaAnalyticsUsageUsersItem of client.beta.organization.analytics.userUsageReport.list(
     *   { starting_at: '2019-12-27T18:11:19.117Z' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(query, options) {
        return this._client.getAPIList('/v1/organizations/analytics/user_usage_report?beta=true', (PageCursor), { query, ...options });
    }
}
//# sourceMappingURL=user-usage-report.mjs.map