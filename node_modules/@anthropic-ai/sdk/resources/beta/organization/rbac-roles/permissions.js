"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Permissions = void 0;
const resource_1 = require("../../../../core/resource.js");
const pagination_1 = require("../../../../core/pagination.js");
const path_1 = require("../../../../internal/utils/path.js");
class Permissions extends resource_1.APIResource {
    /**
     * List the permissions an RBAC Role grants.
     *
     * The RBAC Roles API is available to Claude Enterprise organizations only.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const betaRBACRolePermission of client.beta.organization.rbacRoles.permissions.list(
     *   'rbac_role_id',
     * )) {
     *   // ...
     * }
     * ```
     */
    list(rbacRoleID, query = {}, options) {
        return this._client.getAPIList((0, path_1.path) `/v1/organizations/rbac_roles/${rbacRoleID}/permissions?beta=true`, (pagination_1.PageCursor), { query, ...options });
    }
}
exports.Permissions = Permissions;
//# sourceMappingURL=permissions.js.map