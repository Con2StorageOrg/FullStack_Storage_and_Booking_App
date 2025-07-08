export interface AuditLog {
  id?: string;
  table_name: string;
  record_id: string;
  action: string;
  user_id?: string;
  old_values?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  new_values?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  created_at: string;
}

export interface LogMessage {
  id?: string;
  timestamp: string;
  level: "error" | "warning" | "info" | "debug";
  message: string;
  source?: string;
  metadata?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}
