import { APIResource } from "../../../../core/resource.mjs";
import { PageCursor } from "../../../../core/pagination.mjs";
export class UserCostReport extends APIResource {
    /**
     * Get per-user cost in USD across a date range.
     *
     * Returns one row per user, ranked by spend. Use this to see which users account
     * for the most cost. Only cost attributable to a seat user is included; for
     * organization-wide totals including direct API-key and automation traffic, use
     * the bucketed `/v1/organizations/analytics/cost_report` endpoint. Available to
     * organizations on a Claude Enterprise plan. Requires an API key with the
     * `read:analytics` scope.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const betaAnalyticsCostUsersItem of client.beta.organization.analytics.userCostReport.list(
     *   { starting_at: '2019-12-27T18:11:19.117Z' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(query, options) {
        return this._client.getAPIList('/v1/organizations/analytics/user_cost_report?beta=true', (PageCursor), { query, ...options });
    }
}
//# sourceMappingURL=user-cost-report.mjs.map