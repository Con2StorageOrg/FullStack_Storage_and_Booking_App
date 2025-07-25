import { SupabaseClient, User } from "@supabase/supabase-js";
import { Database } from "src/types/supabase.types";
import { Request } from "express";
import { UserRoleWithDetails } from "../../modules/role/interfaces/role.interface";

/**
 * Extended Express `Request` with Supabase context and roles.
 *
 * @property {import('@supabase/supabase-js').SupabaseClient<import('src/types/supabase').Database>} supabase
 *   Supabase client scoped with the caller’s JWT (RLS-aware).
 * @property {import('@supabase/supabase-js').User} user
 *   User record returned by Supabase Auth.
 * @property {UserRoleWithDetails[]} userRoles
 */
export interface AuthRequest extends Request {
  supabase: SupabaseClient<Database>;
  user: User;
  userRoles: UserRoleWithDetails[];
}
