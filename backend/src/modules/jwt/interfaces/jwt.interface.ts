import { User } from "@supabase/supabase-js";

export interface JWTRole {
  id: string;
  name: string;
  org_id: string;
  org_name: string;
  role_id: string;
  created_at: string;
}

export interface JWTPayload extends Omit<User, "app_metadata"> {
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  email?: string;
  app_metadata?: {
    roles?: JWTRole[];
    role_count?: number;
    last_role_sync?: string;
  };
}
