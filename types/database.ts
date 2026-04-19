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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bill_cycle_amounts: {
        Row: {
          amount: number
          bill_id: string
          created_at: string
          cycle_id: string
          id: string
          updated_at: string
        }
        Insert: {
          amount: number
          bill_id: string
          created_at?: string
          cycle_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bill_id?: string
          created_at?: string
          cycle_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_cycle_amounts_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "recurring_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_cycle_amounts_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "billing_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_cycle_payments: {
        Row: {
          bill_id: string
          created_at: string
          cycle_id: string
          id: string
          member_id: string
          settled_at: string
        }
        Insert: {
          bill_id: string
          created_at?: string
          cycle_id: string
          id?: string
          member_id: string
          settled_at?: string
        }
        Update: {
          bill_id?: string
          created_at?: string
          cycle_id?: string
          id?: string
          member_id?: string
          settled_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_cycle_payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "recurring_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_cycle_payments_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "billing_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_cycle_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_balances"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "bill_cycle_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_push_tokens"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "bill_cycle_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_cycles: {
        Row: {
          closed_at: string | null
          created_at: string
          end_date: string
          household_id: string
          id: string
          start_date: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          end_date: string
          household_id: string
          id?: string
          start_date: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          end_date?: string
          household_id?: string
          id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_cycles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_category_preferences: {
        Row: {
          category: Database["public"]["Enums"]["expense_category"]
          custom_label: string | null
          hidden: boolean
          household_id: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["expense_category"]
          custom_label?: string | null
          hidden?: boolean
          household_id: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["expense_category"]
          custom_label?: string | null
          hidden?: boolean
          household_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_category_preferences_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_splits: {
        Row: {
          amount_owed: number
          expense_id: string
          id: string
          member_id: string
          settled_at: string | null
          settlement_id: string | null
        }
        Insert: {
          amount_owed: number
          expense_id: string
          id?: string
          member_id: string
          settled_at?: string | null
          settlement_id?: string | null
        }
        Update: {
          amount_owed?: number
          expense_id?: string
          id?: string
          member_id?: string
          settled_at?: string | null
          settlement_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_splits_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_splits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_balances"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "expense_splits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_push_tokens"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "expense_splits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_splits_settlement"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          cycle_id: string
          date: string
          description: string
          due_date: string | null
          household_id: string
          id: string
          paid_by_member_id: string
          recurring_bill_id: string | null
        }
        Insert: {
          amount: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          cycle_id: string
          date?: string
          description: string
          due_date?: string | null
          household_id: string
          id?: string
          paid_by_member_id: string
          recurring_bill_id?: string | null
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          cycle_id?: string
          date?: string
          description?: string
          due_date?: string | null
          household_id?: string
          id?: string
          paid_by_member_id?: string
          recurring_bill_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "billing_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_member_id_fkey"
            columns: ["paid_by_member_id"]
            isOneToOne: false
            referencedRelation: "member_balances"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "expenses_paid_by_member_id_fkey"
            columns: ["paid_by_member_id"]
            isOneToOne: false
            referencedRelation: "member_push_tokens"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "expenses_paid_by_member_id_fkey"
            columns: ["paid_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_recurring_bill_id_fkey"
            columns: ["recurring_bill_id"]
            isOneToOne: false
            referencedRelation: "recurring_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          address: string | null
          created_at: string
          cycle_start_day: number
          id: string
          invite_token: string
          name: string
          timezone: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          cycle_start_day?: number
          id?: string
          invite_token?: string
          name: string
          timezone?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          cycle_start_day?: number
          id?: string
          invite_token?: string
          name?: string
          timezone?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          color: string
          display_name: string
          household_id: string
          id: string
          joined_at: string
          left_at: string | null
          phone: string | null
          user_id: string | null
        }
        Insert: {
          color?: string
          display_name: string
          household_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          phone?: string | null
          user_id?: string | null
        }
        Update: {
          color?: string
          display_name?: string
          household_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          phone?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      move_outs: {
        Row: {
          completed_at: string | null
          created_at: string
          cycle_total_days: number
          departing_member_id: string
          household_id: string
          id: string
          move_out_date: string
          pdf_url: string | null
          prorated_days_present: number
          settlement_amount: number | null
          settlement_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          cycle_total_days: number
          departing_member_id: string
          household_id: string
          id?: string
          move_out_date: string
          pdf_url?: string | null
          prorated_days_present: number
          settlement_amount?: number | null
          settlement_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          cycle_total_days?: number
          departing_member_id?: string
          household_id?: string
          id?: string
          move_out_date?: string
          pdf_url?: string | null
          prorated_days_present?: number
          settlement_amount?: number | null
          settlement_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "move_outs_departing_member_id_fkey"
            columns: ["departing_member_id"]
            isOneToOne: false
            referencedRelation: "member_balances"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "move_outs_departing_member_id_fkey"
            columns: ["departing_member_id"]
            isOneToOne: false
            referencedRelation: "member_push_tokens"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "move_outs_departing_member_id_fkey"
            columns: ["departing_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_outs_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_outs_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_bills: {
        Row: {
          active: boolean
          amount: number | null
          created_at: string
          custom_splits: Json | null
          frequency: Database["public"]["Enums"]["bill_cycle_frequency"]
          household_id: string
          id: string
          name: string
          next_due_date: string
          split_type: Database["public"]["Enums"]["split_type"]
        }
        Insert: {
          active?: boolean
          amount?: number | null
          created_at?: string
          custom_splits?: Json | null
          frequency?: Database["public"]["Enums"]["bill_cycle_frequency"]
          household_id: string
          id?: string
          name: string
          next_due_date: string
          split_type?: Database["public"]["Enums"]["split_type"]
        }
        Update: {
          active?: boolean
          amount?: number | null
          created_at?: string
          custom_splits?: Json | null
          frequency?: Database["public"]["Enums"]["bill_cycle_frequency"]
          household_id?: string
          id?: string
          name?: string
          next_due_date?: string
          split_type?: Database["public"]["Enums"]["split_type"]
        }
        Relationships: [
          {
            foreignKeyName: "recurring_bills_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          amount: number
          cycle_id: string | null
          from_member_id: string
          household_id: string
          id: string
          method: Database["public"]["Enums"]["settlement_method"]
          notes: string | null
          settled_at: string
          to_member_id: string
        }
        Insert: {
          amount: number
          cycle_id?: string | null
          from_member_id: string
          household_id: string
          id?: string
          method?: Database["public"]["Enums"]["settlement_method"]
          notes?: string | null
          settled_at?: string
          to_member_id: string
        }
        Update: {
          amount?: number
          cycle_id?: string | null
          from_member_id?: string
          household_id?: string
          id?: string
          method?: Database["public"]["Enums"]["settlement_method"]
          notes?: string | null
          settled_at?: string
          to_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "billing_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_from_member_id_fkey"
            columns: ["from_member_id"]
            isOneToOne: false
            referencedRelation: "member_balances"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "settlements_from_member_id_fkey"
            columns: ["from_member_id"]
            isOneToOne: false
            referencedRelation: "member_push_tokens"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "settlements_from_member_id_fkey"
            columns: ["from_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_to_member_id_fkey"
            columns: ["to_member_id"]
            isOneToOne: false
            referencedRelation: "member_balances"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "settlements_to_member_id_fkey"
            columns: ["to_member_id"]
            isOneToOne: false
            referencedRelation: "member_push_tokens"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "settlements_to_member_id_fkey"
            columns: ["to_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          expires_at: string | null
          household_id: string
          id: string
          product_id: string | null
          revenuecat_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          expires_at?: string | null
          household_id: string
          id?: string
          product_id?: string | null
          revenuecat_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          expires_at?: string | null
          household_id?: string
          id?: string
          product_id?: string | null
          revenuecat_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      member_balances: {
        Row: {
          color: string | null
          display_name: string | null
          household_id: string | null
          member_id: string | null
          net_balance: number | null
          total_owed: number | null
          total_paid: number | null
        }
        Relationships: [
          {
            foreignKeyName: "members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      member_push_tokens: {
        Row: {
          household_id: string | null
          member_id: string | null
          platform: string | null
          token: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      close_and_open_cycle: { Args: { hid: string }; Returns: string }
      complete_move_out: {
        Args: {
          p_household_id: string
          p_member_id: string
          p_move_out_date: string
        }
        Returns: string
      }
      create_household: {
        Args: {
          p_address?: string
          p_cycle_start_day?: number
          p_display_name: string
          p_name: string
          p_timezone?: string
        }
        Returns: string
      }
      is_household_member: { Args: { hid: string }; Returns: boolean }
      join_household_by_token: { Args: { token: string }; Returns: string }
      rotate_invite_token: { Args: { hid: string }; Returns: string }
      settle_pair: {
        Args: {
          p_amount: number
          p_from_member_id: string
          p_household_id: string
          p_method?: Database["public"]["Enums"]["settlement_method"]
          p_notes?: string
          p_to_member_id: string
        }
        Returns: string
      }
      was_household_member: { Args: { hid: string }; Returns: boolean }
    }
    Enums: {
      bill_cycle_frequency:
        | "weekly"
        | "biweekly"
        | "monthly"
        | "monthly_first"
        | "monthly_last"
      expense_category:
        | "rent"
        | "utilities"
        | "groceries"
        | "household"
        | "food"
        | "transport"
        | "other"
      settlement_method: "venmo" | "cashapp" | "cash" | "other"
      split_type: "equal" | "custom_pct" | "custom_amt"
      subscription_status: "active" | "expired" | "cancelled" | "trial"
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
      bill_cycle_frequency: ["weekly", "biweekly", "monthly", "monthly_first", "monthly_last"],
      expense_category: [
        "rent",
        "utilities",
        "groceries",
        "household",
        "food",
        "transport",
        "other",
      ],
      settlement_method: ["venmo", "cashapp", "cash", "other"],
      split_type: ["equal", "custom_pct", "custom_amt"],
      subscription_status: ["active", "expired", "cancelled", "trial"],
    },
  },
} as const
