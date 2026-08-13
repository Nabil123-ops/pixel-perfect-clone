export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      chat_memory: {
        Row: {
          user_id: string | null
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          workflow_id: string | null
        }
        Insert: {
          user_id?: string
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          workflow_id?: string | null
        }
        Update: {
          user_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_memory_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      credentials: {
        Row: {
          user_id: string | null
          created_at: string
          data_encrypted: string
          id: string
          last_test_message: string | null
          last_test_ok: boolean | null
          last_tested_at: string | null
          name: string
          oauth_state: string | null
          type: string
          updated_at: string
        }
        Insert: {
          user_id?: string
          created_at?: string
          data_encrypted?: string
          id?: string
          last_test_message?: string | null
          last_test_ok?: boolean | null
          last_tested_at?: string | null
          name: string
          oauth_state?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          created_at?: string
          data_encrypted?: string
          id?: string
          last_test_message?: string | null
          last_test_ok?: boolean | null
          last_tested_at?: string | null
          name?: string
          oauth_state?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      execution_steps: {
        Row: {
          user_id: string | null
          attempts: number
          created_at: string
          error: string | null
          execution_id: string
          id: string
          input: Json | null
          label: string
          logs: Json | null
          ms: number
          node_id: string
          node_kind: string
          ordinal: number
          output: Json | null
          status: string
        }
        Insert: {
          user_id?: string
          attempts?: number
          created_at?: string
          error?: string | null
          execution_id: string
          id?: string
          input?: Json | null
          label?: string
          logs?: Json | null
          ms?: number
          node_id: string
          node_kind?: string
          ordinal?: number
          output?: Json | null
          status?: string
        }
        Update: {
          user_id?: string
          attempts?: number
          created_at?: string
          error?: string | null
          execution_id?: string
          id?: string
          input?: Json | null
          label?: string
          logs?: Json | null
          ms?: number
          node_id?: string
          node_kind?: string
          ordinal?: number
          output?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_steps_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "executions"
            referencedColumns: ["id"]
          },
        ]
      }
      executions: {
        Row: {
          user_id: string | null
          duration_ms: number | null
          error: string | null
          finished_at: string | null
          id: string
          mode: string
          started_at: string
          status: string
          trigger_payload: Json | null
          workflow_id: string | null
          workflow_name: string
        }
        Insert: {
          user_id?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          started_at?: string
          status?: string
          trigger_payload?: Json | null
          workflow_id?: string | null
          workflow_name?: string
        }
        Update: {
          user_id?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          started_at?: string
          status?: string
          trigger_payload?: Json | null
          workflow_id?: string | null
          workflow_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          user_id: string | null
          created_at: string
          cron_expression: string
          id: string
          next_run_at: string | null
          node_id: string
          workflow_id: string
        }
        Insert: {
          user_id?: string
          created_at?: string
          cron_expression?: string
          id?: string
          next_run_at?: string | null
          node_id: string
          workflow_id: string
        }
        Update: {
          user_id?: string
          created_at?: string
          cron_expression?: string
          id?: string
          next_run_at?: string | null
          node_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      trigger_state: {
        Row: {
          user_id: string | null
          id: string
          last_run_at: string | null
          node_id: string
          seen: Json
          workflow_id: string
        }
        Insert: {
          user_id?: string
          id?: string
          last_run_at?: string | null
          node_id: string
          seen?: Json
          workflow_id: string
        }
        Update: {
          user_id?: string
          id?: string
          last_run_at?: string | null
          node_id?: string
          seen?: Json
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trigger_state_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_registrations: {
        Row: {
          user_id: string | null
          auth_mode: string
          created_at: string
          id: string
          method: string
          node_id: string
          path: string
          workflow_id: string
        }
        Insert: {
          user_id?: string
          auth_mode?: string
          created_at?: string
          id?: string
          method?: string
          node_id: string
          path: string
          workflow_id: string
        }
        Update: {
          user_id?: string
          auth_mode?: string
          created_at?: string
          id?: string
          method?: string
          node_id?: string
          path?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_registrations_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_versions: {
        Row: {
          user_id: string | null
          created_at: string
          edges: Json
          id: string
          name: string
          nodes: Json
          version: number
          workflow_id: string
        }
        Insert: {
          user_id?: string
          created_at?: string
          edges: Json
          id?: string
          name: string
          nodes: Json
          version: number
          workflow_id: string
        }
        Update: {
          user_id?: string
          created_at?: string
          edges?: Json
          id?: string
          name?: string
          nodes?: Json
          version?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_versions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          user_id: string | null
          active: boolean
          created_at: string
          edges: Json
          id: string
          last_run_at: string | null
          name: string
          nodes: Json
          pinned: Json
          updated_at: string
          version: number
        }
        Insert: {
          user_id?: string
          active?: boolean
          created_at?: string
          edges?: Json
          id?: string
          last_run_at?: string | null
          name?: string
          nodes?: Json
          pinned?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          user_id?: string
          active?: boolean
          created_at?: string
          edges?: Json
          id?: string
          last_run_at?: string | null
          name?: string
          nodes?: Json
          pinned?: Json
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
