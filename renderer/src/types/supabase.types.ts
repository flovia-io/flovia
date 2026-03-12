/**
 * Supabase integration types
 */

export interface SupabaseConfig {
  /** Whether Supabase was detected in the project */
  detected: boolean;
  /** The Supabase project URL if found */
  projectUrl: string | null;
  /** The project reference ID extracted from URL */
  projectRef: string | null;
  /** Source file where config was found */
  sourceFile: string | null;
  /** Service role key for admin operations */
  serviceRoleKey?: string | null;
}

export interface SupabaseUser {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
}

export interface SupabaseUsersResult {
  success: boolean;
  users: SupabaseUser[];
  error?: string;
}

export interface SupabaseBucket {
  id: string;
  name: string;
  public: boolean;
  created_at: string;
  updated_at: string;
  file_size_limit: number | null;
  allowed_mime_types: string[] | null;
}

export interface SupabaseStorageResult {
  success: boolean;
  buckets: SupabaseBucket[];
  error?: string;
}

export interface SupabaseTable {
  table_name: string;
  table_schema: string;
  table_type: string;
}

export interface SupabaseTablesResult {
  success: boolean;
  tables: SupabaseTable[];
  error?: string;
}

export interface SqlQueryResult {
  success: boolean;
  data: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
  error?: string;
  executionTime?: number;
}
