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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      customer_push_tokens: {
        Row: {
          created_at: string
          fcm_token: string
          id: string
          is_active: boolean
          ticket_number: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          fcm_token: string
          id?: string
          is_active?: boolean
          ticket_number: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          fcm_token?: string
          id?: string
          is_active?: boolean
          ticket_number?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      internal_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read_by: string[] | null
          order_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read_by?: string[] | null
          order_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read_by?: string[] | null
          order_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          order_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          order_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          order_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_verifications: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          email: string
          expires_at: string
          id: string
          purpose: string
          target_email: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          purpose: string
          target_email?: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          purpose?: string
          target_email?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_approved: boolean | null
          requested_role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          is_approved?: boolean | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_approved?: boolean | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      saved_customers: {
        Row: {
          created_at: string
          created_by: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          id?: string
        }
        Relationships: []
      }
      service_orders: {
        Row: {
          assigned_technician: string | null
          created_at: string
          created_by: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          damage_description: string | null
          deleted_at: string | null
          device_brand: string
          device_model: string
          device_password: string | null
          device_type: string
          edited_at: string | null
          edited_by: string | null
          estimated_cost: number | null
          final_cost: number | null
          id: string
          invoice_items: Json | null
          is_picked_up: boolean
          notes: string | null
          serial_number: string | null
          service_type: string
          status: Database["public"]["Enums"]["service_status"]
          ticket_number: string
          unit_accessories: string | null
          unit_checks: Json | null
          unit_condition: string
          update_delay_reason: string | null
          updated_at: string
          warranty_duration: number | null
          warranty_expiry: string | null
          warranty_notes: string | null
          warranty_unit: string | null
        }
        Insert: {
          assigned_technician?: string | null
          created_at?: string
          created_by: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          damage_description?: string | null
          deleted_at?: string | null
          device_brand: string
          device_model: string
          device_password?: string | null
          device_type: string
          edited_at?: string | null
          edited_by?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          id?: string
          invoice_items?: Json | null
          is_picked_up?: boolean
          notes?: string | null
          serial_number?: string | null
          service_type: string
          status?: Database["public"]["Enums"]["service_status"]
          ticket_number: string
          unit_accessories?: string | null
          unit_checks?: Json | null
          unit_condition: string
          update_delay_reason?: string | null
          updated_at?: string
          warranty_duration?: number | null
          warranty_expiry?: string | null
          warranty_notes?: string | null
          warranty_unit?: string | null
        }
        Update: {
          assigned_technician?: string | null
          created_at?: string
          created_by?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          damage_description?: string | null
          deleted_at?: string | null
          device_brand?: string
          device_model?: string
          device_password?: string | null
          device_type?: string
          edited_at?: string | null
          edited_by?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          id?: string
          invoice_items?: Json | null
          is_picked_up?: boolean
          notes?: string | null
          serial_number?: string | null
          service_type?: string
          status?: Database["public"]["Enums"]["service_status"]
          ticket_number?: string
          unit_accessories?: string | null
          unit_checks?: Json | null
          unit_condition?: string
          update_delay_reason?: string | null
          updated_at?: string
          warranty_duration?: number | null
          warranty_expiry?: string | null
          warranty_notes?: string | null
          warranty_unit?: string | null
        }
        Relationships: []
      }
      service_photos: {
        Row: {
          created_at: string
          id: string
          label: string
          order_id: string
          photo_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          order_id: string
          photo_url: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          order_id?: string
          photo_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_photos_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_updates: {
        Row: {
          cancel_type: string | null
          created_at: string
          description: string | null
          id: string
          order_id: string
          status: Database["public"]["Enums"]["service_status"]
          updated_by: string
        }
        Insert: {
          cancel_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order_id: string
          status: Database["public"]["Enums"]["service_status"]
          updated_by: string
        }
        Update: {
          cancel_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string
          status?: Database["public"]["Enums"]["service_status"]
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_updates_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_push_tokens: {
        Row: {
          created_at: string
          fcm_token: string
          id: string
          is_active: boolean
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fcm_token: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          fcm_token?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_order_by_ticket: {
        Args: { _ticket: string }
        Returns: {
          created_at: string
          customer_name: string
          device_brand: string
          device_model: string
          device_type: string
          final_cost: number
          id: string
          invoice_items: Json
          notes: string
          service_type: string
          status: string
          ticket_number: string
          unit_checks: Json
          unit_condition: string
        }[]
      }
      get_public_photos_by_ticket: {
        Args: { _ticket: string }
        Returns: {
          label: string
          photo_url: string
        }[]
      }
      get_public_updates_by_ticket: {
        Args: { _ticket: string }
        Returns: {
          cancel_type: string
          created_at: string
          description: string
          status: string
        }[]
      }
      get_staff_identities: {
        Args: { _user_ids: string[] }
        Returns: {
          full_name: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_otp: { Args: { _code: string }; Returns: string }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      lookup_login_email: { Args: { _identifier: string }; Returns: string }
    }
    Enums: {
      app_role: "owner" | "admin" | "technician"
      service_status:
        | "Diterima"
        | "Diagnosa"
        | "Menunggu Konfirmasi"
        | "Pending"
        | "Perbaikan"
        | "Selesai"
        | "Siap diAmbil"
        | "Close"
        | "Cancelled"
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
    Enums: {
      app_role: ["owner", "admin", "technician"],
      service_status: [
        "Diterima",
        "Diagnosa",
        "Menunggu Konfirmasi",
        "Pending",
        "Perbaikan",
        "Selesai",
        "Siap diAmbil",
        "Close",
        "Cancelled",
      ],
    },
  },
} as const
