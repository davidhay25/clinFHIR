"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsageReport = void 0;
const resource_1 = require("../../../../core/resource.js");
const pagination_1 = require("../../../../core/pagination.js");
class UsageReport extends resource_1.APIResource {
    /**
     * Get token usage over time across a date range.
     *
     * Returns token usage bucketed by minute, hour, or day, optionally broken down by
     * product, model, context window, inference region, or speed. Available to
     * organizations on a Claude Enterprise plan. Requires an API key with the
     * `read:analytics` scope.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const betaAnalyticsUsageReportTimeBucket of client.beta.organization.analytics.usageReport.list(
     *   { starting_at: '2019-12-27T18:11:19.117Z' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(query, options) {
        return this._client.getAPIList('/v1/organizations/analytics/usage_report?beta=true', (pagination_1.PageCursor), { query, ...options });
    }
}
exports.UsageReport = UsageReport;
//# sourceMappingURL=usage-report.js.map