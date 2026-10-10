"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RBACGroups = void 0;
const tslib_1 = require("../../../../internal/tslib.js");
const resource_1 = require("../../../../core/resource.js");
const MembersAPI = tslib_1.__importStar(require("./members.js"));
const members_1 = require("./members.js");
const pagination_1 = require("../../../../core/pagination.js");
const path_1 = require("../../../../internal/utils/path.js");
var RBACGroups = /* @__PURE__ */ (() => {
    class RBACGroups extends resource_1.APIResource {
        constructor() {
            super(...arguments);
            this.members = new MembersAPI.Members(this._client);
        }
        /**
         * Create an RBAC Group in the Claude Enterprise tenant. Groups created via the API
         * have source type `"direct"`.
         *
         * The RBAC Groups API is available to Claude Enterprise organizations only.
         *
         * @example
         * ```ts
         * const betaRBACGroup =
         *   await client.beta.organization.rbacGroups.create({
         *     name: 'Engineering',
         *   });
         * ```
         */
        create(body, options) {
            return this._client.post('/v1/organizations/rbac_groups?beta=true', { body, ...options });
        }
        /**
         * Retrieve an RBAC Group by ID.
         *
         * The RBAC Groups API is available to Claude Enterprise organizations only.
         *
         * @example
         * ```ts
         * const betaRBACGroup =
         *   await client.beta.organization.rbacGroups.retrieve(
         *     'rbac_group_id',
         *   );
         * ```
         */
        retrieve(rbacGroupID, options) {
            return this._client.get((0, path_1.path) `/v1/organizations/rbac_groups/${rbacGroupID}?beta=true`, options);
        }
        /**
         * Update an RBAC Group's name. Groups provisioned by an identity provider (source
         * type `"scim"`) cannot be modified via the API while an organization in the
         * tenant uses SCIM provisioning.
         *
         * The RBAC Groups API is available to Claude Enterprise organizations only.
         *
         * @example
         * ```ts
         * const betaRBACGroup =
         *   await client.beta.organization.rbacGroups.update(
         *     'rbac_group_id',
         *   );
         * ```
         */
        update(rbacGroupID, body, options) {
            return this._client.post((0, path_1.path) `/v1/organizations/rbac_groups/${rbacGroupID}?beta=true`, {
                body,
                ...options,
            });
        }
        /**
         * List RBAC Groups in the Claude Enterprise tenant.
         *
         * The RBAC Groups API is available to Claude Enterprise organizations only.
         *
         * @example
         * ```ts
         * // Automatically fetches more pages as needed.
         * for await (const betaRBACGroup of client.beta.organization.rbacGroups.list()) {
         *   // ...
         * }
         * ```
         */
        list(query = {}, options) {
            return this._client.getAPIList('/v1/organizations/rbac_groups?beta=true', (pagination_1.PageCursor), {
                query,
                ...options,
            });
        }
        /**
         * Delete an RBAC Group. Groups provisioned by an identity provider (source type
         * `"scim"`) cannot be deleted via the API while an organization in the tenant uses
         * SCIM provisioning.
         *
         * The RBAC Groups API is available to Claude Enterprise organizations only.
         *
         * @example
         * ```ts
         * const rbacGroup =
         *   await client.beta.organization.rbacGroups.delete(
         *     'rbac_group_id',
         *   );
         * ```
         */
        delete(rbacGroupID, options) {
            return this._client.delete((0, path_1.path) `/v1/organizations/rbac_groups/${rbacGroupID}?beta=true`, options);
        }
    }
    RBACGroups.Members = members_1.Members;
    return RBACGroups;
})();
exports.RBACGroups = RBACGroups;
//# sourceMappingURL=rbac-groups.js.map