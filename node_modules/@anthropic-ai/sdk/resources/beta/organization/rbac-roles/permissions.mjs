import { APIResource } from "../../../../core/resource.mjs";
import { PageCursor } from "../../../../core/pagination.mjs";
import { path } from "../../../../internal/utils/path.mjs";
export class Permissions extends APIResource {
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
        return this._client.getAPIList(path `/v1/organizations/rbac_roles/${rbacRoleID}/permissions?beta=true`, (PageCursor), { query, ...options });
    }
}
//# sourceMappingURL=permissions.mjs.map