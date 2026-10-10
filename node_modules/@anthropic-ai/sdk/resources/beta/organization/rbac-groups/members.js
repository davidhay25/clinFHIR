"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Members = void 0;
const resource_1 = require("../../../../core/resource.js");
const pagination_1 = require("../../../../core/pagination.js");
const path_1 = require("../../../../internal/utils/path.js");
class Members extends resource_1.APIResource {
    /**
     * List members of an RBAC Group.
     *
     * The RBAC Groups API is available to Claude Enterprise organizations only.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const betaRBACGroupMember of client.beta.organization.rbacGroups.members.list(
     *   'rbac_group_id',
     * )) {
     *   // ...
     * }
     * ```
     */
    list(rbacGroupID, query = {}, options) {
        return this._client.getAPIList((0, path_1.path) `/v1/organizations/rbac_groups/${rbacGroupID}/members?beta=true`, (pagination_1.PageCursor), { query, ...options });
    }
    /**
     * Add a User to an RBAC Group. Membership of groups provisioned by an identity
     * provider (source type `"scim"`) cannot be modified via the API while an
     * organization in the tenant uses SCIM provisioning.
     *
     * The RBAC Groups API is available to Claude Enterprise organizations only.
     *
     * @example
     * ```ts
     * const betaRBACGroupMember =
     *   await client.beta.organization.rbacGroups.members.add(
     *     'rbac_group_id',
     *     { user_id: 'user_01WCz1FkmYMm4gnmykNKUu3Q' },
     *   );
     * ```
     */
    add(rbacGroupID, body, options) {
        return this._client.post((0, path_1.path) `/v1/organizations/rbac_groups/${rbacGroupID}/members?beta=true`, {
            body,
            ...options,
        });
    }
    /**
     * Remove a User from an RBAC Group. Membership of groups provisioned by an
     * identity provider (source type `"scim"`) cannot be modified via the API while an
     * organization in the tenant uses SCIM provisioning.
     *
     * The RBAC Groups API is available to Claude Enterprise organizations only.
     *
     * @example
     * ```ts
     * const member =
     *   await client.beta.organization.rbacGroups.members.remove(
     *     'user_id',
     *     { rbac_group_id: 'rbac_group_id' },
     *   );
     * ```
     */
    remove(userID, params, options) {
        const { rbac_group_id } = params;
        return this._client.delete((0, path_1.path) `/v1/organizations/rbac_groups/${rbac_group_id}/members/${userID}?beta=true`, options);
    }
}
exports.Members = Members;
//# sourceMappingURL=members.js.map