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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      campaigns: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_source_nodes: {
        Row: {
          connected_stage_id: string | null
          created_at: string
          funnel_id: string
          icon_type: string
          id: string
          lead_count: number
          name: string
          position_x: number
          position_y: number
        }
        Insert: {
          connected_stage_id?: string | null
          created_at?: string
          funnel_id: string
          icon_type?: string
          id?: string
          lead_count?: number
          name: string
          position_x?: number
          position_y?: number
        }
        Update: {
          connected_stage_id?: string | null
          created_at?: string
          funnel_id?: string
          icon_type?: string
          id?: string
          lead_count?: number
          name?: string
          position_x?: number
          position_y?: number
        }
        Relationships: [
          {
            foreignKeyName: "funnel_source_nodes_connected_stage_id_fkey"
            columns: ["connected_stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_source_nodes_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_stages: {
        Row: {
          color: string
          created_at: string
          funnel_id: string
          id: string
          name: string
          order_index: number
          page_url: string | null
          position_x: number
          position_y: number
          thumbnail_url: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          funnel_id: string
          id?: string
          name: string
          order_index?: number
          page_url?: string | null
          position_x?: number
          position_y?: number
          thumbnail_url?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          funnel_id?: string
          id?: string
          name?: string
          order_index?: number
          page_url?: string | null
          position_x?: number
          position_y?: number
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_stages_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      funnels: {
        Row: {
          campaign_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          webhook_token: string
          workspace_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          webhook_token?: string
          workspace_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          webhook_token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnels_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_events: {
        Row: {
          created_at: string
          event_name: string
          funnel_id: string
          id: string
          idempotency_key: string | null
          lead_id: string
          payload_raw: Json
          source: string
          timestamp_event: string
        }
        Insert: {
          created_at?: string
          event_name: string
          funnel_id: string
          id?: string
          idempotency_key?: string | null
          lead_id: string
          payload_raw?: Json
          source?: string
          timestamp_event?: string
        }
        Update: {
          created_at?: string
          event_name?: string
          funnel_id?: string
          id?: string
          idempotency_key?: string | null
          lead_id?: string
          payload_raw?: Json
          source?: string
          timestamp_event?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_funnel_stages: {
        Row: {
          converted_at: string | null
          entered_at: string
          funnel_id: string
          id: string
          lead_id: string
          moved_by: string
          page_url: string | null
          previous_stage_id: string | null
          source: string
          stage_id: string
          updated_at: string
        }
        Insert: {
          converted_at?: string | null
          entered_at?: string
          funnel_id: string
          id?: string
          lead_id: string
          moved_by?: string
          page_url?: string | null
          previous_stage_id?: string | null
          source?: string
          stage_id: string
          updated_at?: string
        }
        Update: {
          converted_at?: string | null
          entered_at?: string
          funnel_id?: string
          id?: string
          lead_id?: string
          moved_by?: string
          page_url?: string | null
          previous_stage_id?: string | null
          source?: string
          stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_funnel_stages_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_funnel_stages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_funnel_stages_previous_stage_id_fkey"
            columns: ["previous_stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_funnel_stages_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tags: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tags_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          city: string | null
          converted_at: string | null
          country: string | null
          created_at: string
          device: string | null
          email: string | null
          first_purchase_at: string | null
          form_id: string | null
          id: string
          imported_at: string | null
          is_ghost: boolean
          is_subscriber: boolean
          last_purchase_at: string | null
          last_signup_at: string | null
          ltv_days: number | null
          metadata: Json
          name: string | null
          page_url: string | null
          phone: string | null
          purchase_count: number
          referral_source: string | null
          region: string | null
          signup_count: number
          source: string
          total_revenue: number
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          workspace_id: string
        }
        Insert: {
          city?: string | null
          converted_at?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          email?: string | null
          first_purchase_at?: string | null
          form_id?: string | null
          id?: string
          imported_at?: string | null
          is_ghost?: boolean
          is_subscriber?: boolean
          last_purchase_at?: string | null
          last_signup_at?: string | null
          ltv_days?: number | null
          metadata?: Json
          name?: string | null
          page_url?: string | null
          phone?: string | null
          purchase_count?: number
          referral_source?: string | null
          region?: string | null
          signup_count?: number
          source?: string
          total_revenue?: number
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          workspace_id: string
        }
        Update: {
          city?: string | null
          converted_at?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          email?: string | null
          first_purchase_at?: string | null
          form_id?: string | null
          id?: string
          imported_at?: string | null
          is_ghost?: boolean
          is_subscriber?: boolean
          last_purchase_at?: string | null
          last_signup_at?: string | null
          ltv_days?: number | null
          metadata?: Json
          name?: string | null
          page_url?: string | null
          phone?: string | null
          purchase_count?: number
          referral_source?: string | null
          region?: string | null
          signup_count?: number
          source?: string
          total_revenue?: number
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      product_mappings: {
        Row: {
          created_at: string
          external_name: string
          id: string
          platform: string
          product_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          external_name: string
          id?: string
          platform: string
          product_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          external_name?: string
          id?: string
          platform?: string
          product_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_mappings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          external_id: string | null
          id: string
          name: string
          platform: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          name: string
          platform?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          name?: string
          platform?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      sale_events: {
        Row: {
          ad_name: string | null
          ad_set_name: string | null
          affiliate: string | null
          buyer_email: string | null
          buyer_name: string | null
          buyer_phone: string | null
          campaign_name: string | null
          card_brand: string | null
          created_at: string
          currency: string
          external_invoice_id: string
          gross_value: number
          id: string
          installments: number
          is_bump: boolean
          is_subscription: boolean
          lead_id: string | null
          net_value: number
          offer_name: string | null
          paid_at: string | null
          payment_method: string | null
          placement: string | null
          platform: string
          product_name: string
          sale_created_at: string | null
          sck: string | null
          src: string | null
          status: string
          subscription_contract: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          workspace_id: string
        }
        Insert: {
          ad_name?: string | null
          ad_set_name?: string | null
          affiliate?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          campaign_name?: string | null
          card_brand?: string | null
          created_at?: string
          currency?: string
          external_invoice_id: string
          gross_value?: number
          id?: string
          installments?: number
          is_bump?: boolean
          is_subscription?: boolean
          lead_id?: string | null
          net_value?: number
          offer_name?: string | null
          paid_at?: string | null
          payment_method?: string | null
          placement?: string | null
          platform: string
          product_name: string
          sale_created_at?: string | null
          sck?: string | null
          src?: string | null
          status?: string
          subscription_contract?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          workspace_id: string
        }
        Update: {
          ad_name?: string | null
          ad_set_name?: string | null
          affiliate?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          campaign_name?: string | null
          card_brand?: string | null
          created_at?: string
          currency?: string
          external_invoice_id?: string
          gross_value?: number
          id?: string
          installments?: number
          is_bump?: boolean
          is_subscription?: boolean
          lead_id?: string | null
          net_value?: number
          offer_name?: string | null
          paid_at?: string | null
          payment_method?: string | null
          placement?: string | null
          platform?: string
          product_name?: string
          sale_created_at?: string | null
          sck?: string | null
          src?: string | null
          status?: string
          subscription_contract?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sentinel_alerts: {
        Row: {
          actual_value: number | null
          alert_type: string
          created_at: string
          description: string | null
          funnel_id: string | null
          id: string
          is_read: boolean
          level: string
          stage_id: string | null
          threshold_value: number | null
          title: string
          workspace_id: string
        }
        Insert: {
          actual_value?: number | null
          alert_type: string
          created_at?: string
          description?: string | null
          funnel_id?: string | null
          id?: string
          is_read?: boolean
          level?: string
          stage_id?: string | null
          threshold_value?: number | null
          title: string
          workspace_id: string
        }
        Update: {
          actual_value?: number | null
          alert_type?: string
          created_at?: string
          description?: string | null
          funnel_id?: string | null
          id?: string
          is_read?: boolean
          level?: string
          stage_id?: string | null
          threshold_value?: number | null
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sentinel_alerts_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sentinel_alerts_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sentinel_alerts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_transition_rules: {
        Row: {
          created_at: string
          event_name: string
          from_stage_id: string | null
          funnel_id: string
          id: string
          priority: number
          to_stage_id: string
        }
        Insert: {
          created_at?: string
          event_name: string
          from_stage_id?: string | null
          funnel_id: string
          id?: string
          priority?: number
          to_stage_id: string
        }
        Update: {
          created_at?: string
          event_name?: string
          from_stage_id?: string | null
          funnel_id?: string
          id?: string
          priority?: number
          to_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_transition_rules_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_transition_rules_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_transition_rules_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          funnel_id: string | null
          id: string
          name: string
          scope: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          funnel_id?: string | null
          id?: string
          name: string
          scope?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          funnel_id?: string | null
          id?: string
          name?: string
          scope?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_all_product_stats: {
        Args: { p_workspace_id: string }
        Returns: {
          has_subscription: boolean
          platform: string
          product_name: string
          total_revenue: number
          total_sales: number
        }[]
      }
      get_campaign_creatives: {
        Args: { p_campaign_id: string }
        Returns: {
          buyer_count: number
          city: string
          device: string
          lead_count: number
          total_revenue: number
          utm_content: string
          utm_source: string
        }[]
      }
      get_campaign_revenue: {
        Args: { p_campaign_id: string }
        Returns: {
          has_subscription: boolean
          platform: string
          product_name: string
          sale_count: number
          total_gross: number
          total_net: number
        }[]
      }
      get_campaign_stats: {
        Args: { p_campaign_id: string }
        Returns: {
          buyer_count: number
          funnel_id: string
          funnel_name: string
          is_active: boolean
          lead_count: number
          stage_count: number
          total_revenue: number
        }[]
      }
      get_funnel_buyer_stats: {
        Args: { p_funnel_id: string }
        Returns: {
          multi_buyers: number
          single_buyers: number
          total_buyers: number
        }[]
      }
      get_funnel_signup_stats: {
        Args: { p_funnel_id: string }
        Returns: {
          duplicate_signups: number
          total_signups: number
          unique_leads: number
        }[]
      }
      get_leads_metrics: {
        Args: never
        Returns: {
          multi_buyers: number
          total_buyers: number
          total_leads: number
          total_revenue: number
        }[]
      }
      get_numeric_product_stats: {
        Args: { p_workspace_id: string }
        Returns: {
          has_subscription: boolean
          platform: string
          product_name: string
          total_revenue: number
          total_sales: number
        }[]
      }
      get_sales_breakdown: { Args: { p_workspace_id: string }; Returns: Json }
      increment_signup_count: {
        Args: { p_lead_id: string }
        Returns: undefined
      }
      recalculate_lead_sales_stats: {
        Args: { p_lead_id: string }
        Returns: undefined
      }
      recalculate_leads_batch: {
        Args: { p_lead_ids: string[] }
        Returns: undefined
      }
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
