import { APIResource } from "../../../../core/resource.mjs";
import { PageCursor } from "../../../../core/pagination.mjs";
export class CostReport extends APIResource {
    /**
     * Get cost in USD over time across a date range.
     *
     * Returns cost bucketed by minute, hour, or day, optionally broken down by
     * product, model, context window, inference region, speed, cost type, or token
     * type. Available to organizations on a Claude Enterprise plan. Requires an API
     * key with the `read:analytics` scope.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const betaAnalyticsCostReportTimeBucket of client.beta.organization.analytics.costReport.list(
     *   { starting_at: '2019-12-27T18:11:19.117Z' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(query, options) {
        return this._client.getAPIList('/v1/organizations/analytics/cost_report?beta=true', (PageCursor), { query, ...options });
    }
}
//# sourceMappingURL=cost-report.mjs.map