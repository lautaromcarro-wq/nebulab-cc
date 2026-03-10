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
      accounts: {
        Row: {
          created_at: string
          currency: string | null
          external_account_id: string
          id: string
          integration_id: string | null
          metadata: Json | null
          name: string
          parent_external_id: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          status: Database["public"]["Enums"]["account_status"]
          timezone: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          external_account_id: string
          id?: string
          integration_id?: string | null
          metadata?: Json | null
          name?: string
          parent_external_id?: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          status?: Database["public"]["Enums"]["account_status"]
          timezone?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          external_account_id?: string
          id?: string
          integration_id?: string | null
          metadata?: Json | null
          name?: string
          parent_external_id?: string | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          status?: Database["public"]["Enums"]["account_status"]
          timezone?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ads: {
        Row: {
          account_id: string
          adset_id: string | null
          campaign_id: string | null
          creative_id: string | null
          external_id: string
          id: string
          landing_url: string | null
          metadata: Json | null
          name: string
          provider: Database["public"]["Enums"]["integration_provider"]
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id: string
          adset_id?: string | null
          campaign_id?: string | null
          creative_id?: string | null
          external_id: string
          id?: string
          landing_url?: string | null
          metadata?: Json | null
          name?: string
          provider: Database["public"]["Enums"]["integration_provider"]
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_id?: string
          adset_id?: string | null
          campaign_id?: string | null
          creative_id?: string | null
          external_id?: string
          id?: string
          landing_url?: string | null
          metadata?: Json | null
          name?: string
          provider?: Database["public"]["Enums"]["integration_provider"]
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_adset_id_fkey"
            columns: ["adset_id"]
            isOneToOne: false
            referencedRelation: "adsets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      adsets: {
        Row: {
          account_id: string
          campaign_id: string
          external_id: string
          id: string
          metadata: Json | null
          name: string
          provider: Database["public"]["Enums"]["integration_provider"]
          status: string
          targeting: Json | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id: string
          campaign_id: string
          external_id: string
          id?: string
          metadata?: Json | null
          name?: string
          provider: Database["public"]["Enums"]["integration_provider"]
          status?: string
          targeting?: Json | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_id?: string
          campaign_id?: string
          external_id?: string
          id?: string
          metadata?: Json | null
          name?: string
          provider?: Database["public"]["Enums"]["integration_provider"]
          status?: string
          targeting?: Json | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adsets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adsets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adsets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          condition: Json
          cooldown_minutes: number
          created_at: string
          created_by: string | null
          destinations: Json | null
          entity_scope: Database["public"]["Enums"]["alert_entity_scope"]
          id: string
          is_enabled: boolean
          name: string
          provider_scope: string[] | null
          rule_type: Database["public"]["Enums"]["alert_rule_type"]
          severity: Database["public"]["Enums"]["alert_severity"]
          workspace_id: string
        }
        Insert: {
          condition?: Json
          cooldown_minutes?: number
          created_at?: string
          created_by?: string | null
          destinations?: Json | null
          entity_scope?: Database["public"]["Enums"]["alert_entity_scope"]
          id?: string
          is_enabled?: boolean
          name: string
          provider_scope?: string[] | null
          rule_type: Database["public"]["Enums"]["alert_rule_type"]
          severity?: Database["public"]["Enums"]["alert_severity"]
          workspace_id: string
        }
        Update: {
          condition?: Json
          cooldown_minutes?: number
          created_at?: string
          created_by?: string | null
          destinations?: Json | null
          entity_scope?: Database["public"]["Enums"]["alert_entity_scope"]
          id?: string
          is_enabled?: boolean
          name?: string
          provider_scope?: string[] | null
          rule_type?: Database["public"]["Enums"]["alert_rule_type"]
          severity?: Database["public"]["Enums"]["alert_severity"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      backfill_runs: {
        Row: {
          chunk_size_days: number
          chunks_completed: number
          chunks_total: number
          client_id: string | null
          created_at: string
          current_chunk_end: string | null
          current_chunk_start: string | null
          details: Json | null
          end_date: string
          error_message: string | null
          id: string
          items_inserted: number
          provider: string
          start_date: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          chunk_size_days?: number
          chunks_completed?: number
          chunks_total?: number
          client_id?: string | null
          created_at?: string
          current_chunk_end?: string | null
          current_chunk_start?: string | null
          details?: Json | null
          end_date: string
          error_message?: string | null
          id?: string
          items_inserted?: number
          provider: string
          start_date: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          chunk_size_days?: number
          chunks_completed?: number
          chunks_total?: number
          client_id?: string | null
          created_at?: string
          current_chunk_end?: string | null
          current_chunk_start?: string | null
          details?: Json | null
          end_date?: string
          error_message?: string | null
          id?: string
          items_inserted?: number
          provider?: string
          start_date?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backfill_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backfill_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      balance_loads: {
        Row: {
          amount: number
          client_id: string
          created_at: string | null
          currency: string
          id: string
          load_date: string
          notes: string | null
          platform: string
          status: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string | null
          currency?: string
          id?: string
          load_date?: string
          notes?: string | null
          platform: string
          status?: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string | null
          currency?: string
          id?: string
          load_date?: string
          notes?: string | null
          platform?: string
          status?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "balance_loads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balance_loads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_personas: {
        Row: {
          channels: string[] | null
          client_id: string
          created_at: string
          demographics: Json | null
          id: string
          jobs_to_be_done: string[] | null
          name: string
          notes: string | null
          objections: string[] | null
          pain_points: string[] | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          channels?: string[] | null
          client_id: string
          created_at?: string
          demographics?: Json | null
          id?: string
          jobs_to_be_done?: string[] | null
          name?: string
          notes?: string | null
          objections?: string[] | null
          pain_points?: string[] | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          channels?: string[] | null
          client_id?: string
          created_at?: string
          demographics?: Json | null
          id?: string
          jobs_to_be_done?: string[] | null
          name?: string
          notes?: string | null
          objections?: string[] | null
          pain_points?: string[] | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_personas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_personas_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_segment_map: {
        Row: {
          account_id: string
          campaign_id: string
          client_id: string | null
          computed_at: string
          id: string
          match_status: Database["public"]["Enums"]["segment_match_status"]
          matched_rules: Json | null
          platform: Database["public"]["Enums"]["integration_provider"]
          segment_id: string | null
          workspace_id: string
        }
        Insert: {
          account_id: string
          campaign_id: string
          client_id?: string | null
          computed_at?: string
          id?: string
          match_status?: Database["public"]["Enums"]["segment_match_status"]
          matched_rules?: Json | null
          platform: Database["public"]["Enums"]["integration_provider"]
          segment_id?: string | null
          workspace_id: string
        }
        Update: {
          account_id?: string
          campaign_id?: string
          client_id?: string | null
          computed_at?: string
          id?: string
          match_status?: Database["public"]["Enums"]["segment_match_status"]
          matched_rules?: Json | null
          platform?: Database["public"]["Enums"]["integration_provider"]
          segment_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_segment_map_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_segment_map_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_segment_map_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_segment_map_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_segment_map_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          account_id: string
          end_date: string | null
          external_id: string
          id: string
          metadata: Json | null
          name: string
          objective: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          start_date: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id: string
          end_date?: string | null
          external_id: string
          id?: string
          metadata?: Json | null
          name: string
          objective?: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          start_date?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_id?: string
          end_date?: string | null
          external_id?: string
          id?: string
          metadata?: Json | null
          name?: string
          objective?: string | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          start_date?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      changelog: {
        Row: {
          change_type: Database["public"]["Enums"]["change_type"]
          created_at: string
          created_by: string
          description: string | null
          expected_impact: string | null
          id: string
          platform: string | null
          status: Database["public"]["Enums"]["changelog_status"]
          template_key: string | null
          title: string
          workspace_id: string
        }
        Insert: {
          change_type: Database["public"]["Enums"]["change_type"]
          created_at?: string
          created_by: string
          description?: string | null
          expected_impact?: string | null
          id?: string
          platform?: string | null
          status?: Database["public"]["Enums"]["changelog_status"]
          template_key?: string | null
          title: string
          workspace_id: string
        }
        Update: {
          change_type?: Database["public"]["Enums"]["change_type"]
          created_at?: string
          created_by?: string
          description?: string | null
          expected_impact?: string | null
          id?: string
          platform?: string | null
          status?: Database["public"]["Enums"]["changelog_status"]
          template_key?: string | null
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "changelog_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      changelog_links: {
        Row: {
          changelog_id: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["changelog_entity_type"]
          id: string
          workspace_id: string
        }
        Insert: {
          changelog_id: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["changelog_entity_type"]
          id?: string
          workspace_id: string
        }
        Update: {
          changelog_id?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["changelog_entity_type"]
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "changelog_links_changelog_id_fkey"
            columns: ["changelog_id"]
            isOneToOne: false
            referencedRelation: "changelog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "changelog_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_accesos: {
        Row: {
          client_id: string
          created_at: string | null
          email_destino: string | null
          estado: string
          fecha_aprobacion: string | null
          fecha_solicitud: string | null
          id: string
          notas: string | null
          notes: string | null
          plataforma: string
          platform: string | null
          status_v2: string | null
          tipo_acceso: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          email_destino?: string | null
          estado?: string
          fecha_aprobacion?: string | null
          fecha_solicitud?: string | null
          id?: string
          notas?: string | null
          notes?: string | null
          plataforma: string
          platform?: string | null
          status_v2?: string | null
          tipo_acceso?: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          email_destino?: string | null
          estado?: string
          fecha_aprobacion?: string | null
          fecha_solicitud?: string | null
          id?: string
          notas?: string | null
          notes?: string | null
          plataforma?: string
          platform?: string | null
          status_v2?: string | null
          tipo_acceso?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_accesos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_accesos_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_access_tokens: {
        Row: {
          active: boolean
          client_id: string
          created_at: string | null
          created_by: string | null
          id: string
          label: string | null
          last_accessed_at: string | null
          token: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          client_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          label?: string | null
          last_accessed_at?: string | null
          token?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          label?: string | null
          last_accessed_at?: string | null
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_access_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_access_tokens_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_access_vault: {
        Row: {
          client_id: string
          created_at: string
          id: string
          notes: string | null
          system_name: string
          username_or_email: string | null
          vault_link: string | null
          workspace_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          system_name: string
          username_or_email?: string | null
          vault_link?: string | null
          workspace_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          system_name?: string
          username_or_email?: string | null
          vault_link?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_access_vault_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_access_vault_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_accionables: {
        Row: {
          assigned_to: string | null
          client_id: string
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          client_id: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_accionables_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_accionables_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_account_settings: {
        Row: {
          account_name: string
          client_id: string
          created_at: string
          external_account_id: string
          id: string
          is_enabled: boolean
          last_seen_at: string | null
          metadata: Json | null
          platform: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_name?: string
          client_id: string
          created_at?: string
          external_account_id: string
          id?: string
          is_enabled?: boolean
          last_seen_at?: string | null
          metadata?: Json | null
          platform: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_name?: string
          client_id?: string
          created_at?: string
          external_account_id?: string
          id?: string
          is_enabled?: boolean
          last_seen_at?: string | null
          metadata?: Json | null
          platform?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_account_settings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_account_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_assets: {
        Row: {
          asset_type: string
          client_id: string
          created_at: string
          id: string
          label: string | null
          url: string
          workspace_id: string
        }
        Insert: {
          asset_type?: string
          client_id: string
          created_at?: string
          id?: string
          label?: string | null
          url: string
          workspace_id: string
        }
        Update: {
          asset_type?: string
          client_id?: string
          created_at?: string
          id?: string
          label?: string | null
          url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_bitacora: {
        Row: {
          author_name: string | null
          body: string
          client_id: string
          created_at: string | null
          id: string
          title: string | null
          type: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          author_name?: string | null
          body: string
          client_id: string
          created_at?: string | null
          id?: string
          title?: string | null
          type?: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          author_name?: string | null
          body?: string
          client_id?: string
          created_at?: string | null
          id?: string
          title?: string | null
          type?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_bitacora_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_bitacora_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_financial_settings: {
        Row: {
          avg_cogs_percent: number
          client_id: string
          created_at: string
          id: string
          iva_percent: number
          payment_fee_percent: number
          refund_percent: number
          shipping_percent: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          avg_cogs_percent?: number
          client_id: string
          created_at?: string
          id?: string
          iva_percent?: number
          payment_fee_percent?: number
          refund_percent?: number
          shipping_percent?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          avg_cogs_percent?: number
          client_id?: string
          created_at?: string
          id?: string
          iva_percent?: number
          payment_fee_percent?: number
          refund_percent?: number
          shipping_percent?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_financial_settings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_financial_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invoices: {
        Row: {
          amount_net: number | null
          amount_total: number | null
          client_id: string
          concept: string | null
          created_at: string | null
          currency: string
          due_date: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          period: string | null
          sent_at: string | null
          status: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          amount_net?: number | null
          amount_total?: number | null
          client_id: string
          concept?: string | null
          created_at?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          period?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          amount_net?: number | null
          amount_total?: number | null
          client_id?: string
          concept?: string | null
          created_at?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          period?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_marca_info: {
        Row: {
          certificaciones: string | null
          client_id: string
          created_at: string | null
          diferenciales: string | null
          historia: string | null
          historia_empresa: string | null
          id: string
          link_drive_activos: string | null
          link_manual_marca: string | null
          notas: string | null
          principales_clientes: string | null
          propuesta_valor: string | null
          publico_objetivo: string | null
          tono_comunicacion: string | null
          updated_at: string | null
          valores_marca: string | null
          workspace_id: string
        }
        Insert: {
          certificaciones?: string | null
          client_id: string
          created_at?: string | null
          diferenciales?: string | null
          historia?: string | null
          historia_empresa?: string | null
          id?: string
          link_drive_activos?: string | null
          link_manual_marca?: string | null
          notas?: string | null
          principales_clientes?: string | null
          propuesta_valor?: string | null
          publico_objetivo?: string | null
          tono_comunicacion?: string | null
          updated_at?: string | null
          valores_marca?: string | null
          workspace_id: string
        }
        Update: {
          certificaciones?: string | null
          client_id?: string
          created_at?: string | null
          diferenciales?: string | null
          historia?: string | null
          historia_empresa?: string | null
          id?: string
          link_drive_activos?: string | null
          link_manual_marca?: string | null
          notas?: string | null
          principales_clientes?: string | null
          propuesta_valor?: string | null
          publico_objetivo?: string | null
          tono_comunicacion?: string | null
          updated_at?: string | null
          valores_marca?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_marca_info_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_marca_info_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_productos: {
        Row: {
          categoria: string | null
          client_id: string
          costo: number | null
          created_at: string | null
          id: string
          marca: string | null
          margen_percent: number | null
          margen_porcentaje: number | null
          nombre: string | null
          nombre_producto: string
          notas: string | null
          precio: number | null
          producto_estrella: boolean | null
          producto_liquidacion: boolean | null
          producto_tactico: boolean | null
          rotacion: string | null
          sku: string | null
          stock: number | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          categoria?: string | null
          client_id: string
          costo?: number | null
          created_at?: string | null
          id?: string
          marca?: string | null
          margen_percent?: number | null
          margen_porcentaje?: number | null
          nombre?: string | null
          nombre_producto: string
          notas?: string | null
          precio?: number | null
          producto_estrella?: boolean | null
          producto_liquidacion?: boolean | null
          producto_tactico?: boolean | null
          rotacion?: string | null
          sku?: string | null
          stock?: number | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          categoria?: string | null
          client_id?: string
          costo?: number | null
          created_at?: string | null
          id?: string
          marca?: string | null
          margen_percent?: number | null
          margen_porcentaje?: number | null
          nombre?: string | null
          nombre_producto?: string
          notas?: string | null
          precio?: number | null
          producto_estrella?: boolean | null
          producto_liquidacion?: boolean | null
          producto_tactico?: boolean | null
          rotacion?: string | null
          sku?: string | null
          stock?: number | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_productos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_productos_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_reports: {
        Row: {
          client_id: string
          created_at: string | null
          created_by: string | null
          id: string
          period_from: string | null
          period_to: string | null
          report_data: Json
          title: string | null
          token: string
          workspace_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          period_from?: string | null
          period_to?: string | null
          report_data?: Json
          title?: string | null
          token?: string
          workspace_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          period_from?: string | null
          period_to?: string | null
          report_data?: Json
          title?: string | null
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_reports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_vertical_financial_settings: {
        Row: {
          avg_cogs_percent: number
          created_at: string
          id: string
          iva_percent: number
          payment_fee_percent: number
          refund_percent: number
          shipping_percent: number
          updated_at: string
          vertical_id: string
          workspace_id: string
        }
        Insert: {
          avg_cogs_percent?: number
          created_at?: string
          id?: string
          iva_percent?: number
          payment_fee_percent?: number
          refund_percent?: number
          shipping_percent?: number
          updated_at?: string
          vertical_id: string
          workspace_id: string
        }
        Update: {
          avg_cogs_percent?: number
          created_at?: string
          id?: string
          iva_percent?: number
          payment_fee_percent?: number
          refund_percent?: number
          shipping_percent?: number
          updated_at?: string
          vertical_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_vertical_financial_settings_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: true
            referencedRelation: "client_verticals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_vertical_financial_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_verticals: {
        Row: {
          business_model: string
          client_id: string
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          business_model?: string
          client_id: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          business_model?: string
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_verticals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_verticals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          fecha_kickoff: string | null
          id: string
          industria: string | null
          name: string
          notes: string | null
          presupuesto_mensual_estimado: number | null
          prioridad: string | null
          responsable_nebulab: string | null
          status: string
          updated_at: string
          website_url: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          fecha_kickoff?: string | null
          id?: string
          industria?: string | null
          name: string
          notes?: string | null
          presupuesto_mensual_estimado?: number | null
          prioridad?: string | null
          responsable_nebulab?: string | null
          status?: string
          updated_at?: string
          website_url?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          fecha_kickoff?: string | null
          id?: string
          industria?: string | null
          name?: string
          notes?: string | null
          presupuesto_mensual_estimado?: number | null
          prioridad?: string | null
          responsable_nebulab?: string | null
          status?: string
          updated_at?: string
          website_url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      competitors: {
        Row: {
          client_id: string
          created_at: string
          id: string
          name: string
          notes: string | null
          url: string | null
          workspace_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          url?: string | null
          workspace_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitors_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitors_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_assets: {
        Row: {
          asset_hash: string | null
          asset_type: Database["public"]["Enums"]["asset_type"]
          asset_url: string
          created_at: string
          creative_id: string | null
          external_asset_id: string | null
          id: string
          metadata: Json | null
          provider: Database["public"]["Enums"]["integration_provider"]
          thumbnail_url: string | null
          workspace_id: string
        }
        Insert: {
          asset_hash?: string | null
          asset_type?: Database["public"]["Enums"]["asset_type"]
          asset_url?: string
          created_at?: string
          creative_id?: string | null
          external_asset_id?: string | null
          id?: string
          metadata?: Json | null
          provider: Database["public"]["Enums"]["integration_provider"]
          thumbnail_url?: string | null
          workspace_id: string
        }
        Update: {
          asset_hash?: string | null
          asset_type?: Database["public"]["Enums"]["asset_type"]
          asset_url?: string
          created_at?: string
          creative_id?: string | null
          external_asset_id?: string | null
          id?: string
          metadata?: Json | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          thumbnail_url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_assets_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_performance_daily: {
        Row: {
          clicks: number | null
          created_at: string
          creative_id: string
          currency: string
          date: string
          id: string
          impressions: number | null
          provider: Database["public"]["Enums"]["integration_provider"]
          purchases: number | null
          revenue: number | null
          spend: number
          workspace_id: string
        }
        Insert: {
          clicks?: number | null
          created_at?: string
          creative_id: string
          currency?: string
          date: string
          id?: string
          impressions?: number | null
          provider: Database["public"]["Enums"]["integration_provider"]
          purchases?: number | null
          revenue?: number | null
          spend?: number
          workspace_id: string
        }
        Update: {
          clicks?: number | null
          created_at?: string
          creative_id?: string
          currency?: string
          date?: string
          id?: string
          impressions?: number | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          purchases?: number | null
          revenue?: number | null
          spend?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_performance_daily_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_performance_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_tag_links: {
        Row: {
          creative_id: string
          id: string
          tag_id: string
          workspace_id: string
        }
        Insert: {
          creative_id: string
          id?: string
          tag_id: string
          workspace_id: string
        }
        Update: {
          creative_id?: string
          id?: string
          tag_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_tag_links_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_tag_links_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "creative_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_tag_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_tags: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      creatives: {
        Row: {
          canonical_hash: string
          canonical_url: string | null
          created_at: string
          creative_type: Database["public"]["Enums"]["creative_type"]
          cta: string | null
          dimensions: string | null
          duration_sec: number | null
          headline: string | null
          id: string
          identity_confidence: Database["public"]["Enums"]["identity_confidence"]
          primary_text: string | null
          workspace_id: string
        }
        Insert: {
          canonical_hash: string
          canonical_url?: string | null
          created_at?: string
          creative_type?: Database["public"]["Enums"]["creative_type"]
          cta?: string | null
          dimensions?: string | null
          duration_sec?: number | null
          headline?: string | null
          id?: string
          identity_confidence?: Database["public"]["Enums"]["identity_confidence"]
          primary_text?: string | null
          workspace_id: string
        }
        Update: {
          canonical_hash?: string
          canonical_url?: string | null
          created_at?: string
          creative_type?: Database["public"]["Enums"]["creative_type"]
          cta?: string | null
          dimensions?: string | null
          duration_sec?: number | null
          headline?: string | null
          id?: string
          identity_confidence?: Database["public"]["Enums"]["identity_confidence"]
          primary_text?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creatives_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credentials: {
        Row: {
          access_token: string
          expires_at: string | null
          id: string
          integration_id: string
          meta_long_lived_token: string | null
          refresh_token: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          access_token: string
          expires_at?: string | null
          id?: string
          integration_id: string
          meta_long_lived_token?: string | null
          refresh_token?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          access_token?: string
          expires_at?: string | null
          id?: string
          integration_id?: string
          meta_long_lived_token?: string | null
          refresh_token?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credentials_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: true
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credentials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      experiments: {
        Row: {
          ai_insight: string | null
          baseline: number | null
          created_at: string
          decision: Database["public"]["Enums"]["experiment_decision"] | null
          description: string | null
          end_date: string | null
          final_value: number | null
          hypothesis: string
          id: string
          linked_changelog_id: string | null
          metric_primary: string
          owner_id: string
          platform: string | null
          result_summary: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["experiment_status"]
          variation_pct: number | null
          workspace_id: string
        }
        Insert: {
          ai_insight?: string | null
          baseline?: number | null
          created_at?: string
          decision?: Database["public"]["Enums"]["experiment_decision"] | null
          description?: string | null
          end_date?: string | null
          final_value?: number | null
          hypothesis: string
          id?: string
          linked_changelog_id?: string | null
          metric_primary?: string
          owner_id: string
          platform?: string | null
          result_summary?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["experiment_status"]
          variation_pct?: number | null
          workspace_id: string
        }
        Update: {
          ai_insight?: string | null
          baseline?: number | null
          created_at?: string
          decision?: Database["public"]["Enums"]["experiment_decision"] | null
          description?: string | null
          end_date?: string | null
          final_value?: number | null
          hypothesis?: string
          id?: string
          linked_changelog_id?: string | null
          metric_primary?: string
          owner_id?: string
          platform?: string | null
          result_summary?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["experiment_status"]
          variation_pct?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiments_linked_changelog_id_fkey"
            columns: ["linked_changelog_id"]
            isOneToOne: false
            referencedRelation: "changelog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_costs: {
        Row: {
          amount: number
          cost_type: Database["public"]["Enums"]["cost_type"]
          created_at: string
          currency: string
          date: string
          id: string
          metadata: Json | null
          notes: string | null
          product_category: string | null
          workspace_id: string
        }
        Insert: {
          amount?: number
          cost_type: Database["public"]["Enums"]["cost_type"]
          created_at?: string
          currency?: string
          date: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          product_category?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          cost_type?: Database["public"]["Enums"]["cost_type"]
          created_at?: string
          currency?: string
          date?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          product_category?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_costs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_revenue: {
        Row: {
          created_at: string
          currency: string
          date: string
          gross_revenue: number
          id: string
          metadata: Json | null
          net_revenue: number | null
          orders: number | null
          source: Database["public"]["Enums"]["revenue_source"]
          workspace_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          date: string
          gross_revenue?: number
          id?: string
          metadata?: Json | null
          net_revenue?: number | null
          orders?: number | null
          source?: Database["public"]["Enums"]["revenue_source"]
          workspace_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          date?: string
          gross_revenue?: number
          id?: string
          metadata?: Json | null
          net_revenue?: number | null
          orders?: number | null
          source?: Database["public"]["Enums"]["revenue_source"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_revenue_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ga4_by_source: {
        Row: {
          account_id: string | null
          client_id: string | null
          created_at: string
          currency: string
          date: string
          id: string
          medium: string
          purchases: number
          revenue: number
          source: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string
          date: string
          id?: string
          medium?: string
          purchases?: number
          revenue?: number
          source?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string
          date?: string
          id?: string
          medium?: string
          purchases?: number
          revenue?: number
          source?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ga4_by_source_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ga4_by_source_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ga4_by_source_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ga4_daily: {
        Row: {
          account_id: string | null
          client_id: string | null
          created_at: string
          currency: string
          date: string
          id: string
          purchases: number
          revenue: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string
          date: string
          id?: string
          purchases?: number
          revenue?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string
          date?: string
          id?: string
          purchases?: number
          revenue?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ga4_daily_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ga4_daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ga4_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      health_events: {
        Row: {
          check_type: string
          client_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: Database["public"]["Enums"]["entity_type"] | null
          id: string
          message: string
          provider: Database["public"]["Enums"]["integration_provider"] | null
          resolved: boolean
          severity: Database["public"]["Enums"]["alert_severity"]
          workspace_id: string
        }
        Insert: {
          check_type: string
          client_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["entity_type"] | null
          id?: string
          message: string
          provider?: Database["public"]["Enums"]["integration_provider"] | null
          resolved?: boolean
          severity?: Database["public"]["Enums"]["alert_severity"]
          workspace_id: string
        }
        Update: {
          check_type?: string
          client_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["entity_type"] | null
          id?: string
          message?: string
          provider?: Database["public"]["Enums"]["integration_provider"] | null
          resolved?: boolean
          severity?: Database["public"]["Enums"]["alert_severity"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          scopes: string[]
          status: Database["public"]["Enums"]["integration_status"]
          token_expires_at: string | null
          token_health: Json | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          provider: Database["public"]["Enums"]["integration_provider"]
          scopes?: string[]
          status?: Database["public"]["Enums"]["integration_status"]
          token_expires_at?: string | null
          token_health?: Json | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          provider?: Database["public"]["Enums"]["integration_provider"]
          scopes?: string[]
          status?: Database["public"]["Enums"]["integration_status"]
          token_expires_at?: string | null
          token_health?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_allowed_accounts: {
        Row: {
          account_id: string
          account_name: string
          created_at: string
          enabled: boolean
          id: string
          workspace_id: string
        }
        Insert: {
          account_id: string
          account_name?: string
          created_at?: string
          enabled?: boolean
          id?: string
          workspace_id: string
        }
        Update: {
          account_id?: string
          account_name?: string
          created_at?: string
          enabled?: boolean
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_allowed_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_allowed_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_allowed_businesses: {
        Row: {
          business_id: string
          business_name: string
          created_at: string
          enabled: boolean
          id: string
          workspace_id: string
        }
        Insert: {
          business_id: string
          business_name?: string
          created_at?: string
          enabled?: boolean
          id?: string
          workspace_id: string
        }
        Update: {
          business_id?: string
          business_name?: string
          created_at?: string
          enabled?: boolean
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_allowed_businesses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_sync_prefs: {
        Row: {
          created_at: string
          id: string
          mode: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_sync_prefs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_checklist: {
        Row: {
          categoria: string
          category: string | null
          client_id: string
          completed_at: string | null
          created_at: string | null
          estado: string
          evidence_url: string | null
          evidencia_link: string | null
          fecha_limite: string | null
          id: string
          item: string
          notas: string | null
          orden: number | null
          prioridad: string
          responsable: string
          title: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          categoria: string
          category?: string | null
          client_id: string
          completed_at?: string | null
          created_at?: string | null
          estado?: string
          evidence_url?: string | null
          evidencia_link?: string | null
          fecha_limite?: string | null
          id?: string
          item: string
          notas?: string | null
          orden?: number | null
          prioridad?: string
          responsable?: string
          title?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          categoria?: string
          category?: string | null
          client_id?: string
          completed_at?: string | null
          created_at?: string | null
          estado?: string
          evidence_url?: string | null
          evidencia_link?: string | null
          fecha_limite?: string | null
          id?: string
          item?: string
          notas?: string | null
          orden?: number | null
          prioridad?: string
          responsable?: string
          title?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_checklist_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_checklist_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_daily: {
        Row: {
          account_id: string
          clicks: number | null
          client_id: string | null
          conversions: number | null
          created_at: string
          currency: string
          date: string
          entity_id: string | null
          entity_type: Database["public"]["Enums"]["entity_type"]
          id: string
          impressions: number | null
          notes: Json | null
          provider: Database["public"]["Enums"]["integration_provider"]
          purchases: number | null
          revenue: number | null
          sessions: number | null
          spend: number
          users_count: number | null
          workspace_id: string
        }
        Insert: {
          account_id: string
          clicks?: number | null
          client_id?: string | null
          conversions?: number | null
          created_at?: string
          currency?: string
          date: string
          entity_id?: string | null
          entity_type: Database["public"]["Enums"]["entity_type"]
          id?: string
          impressions?: number | null
          notes?: Json | null
          provider: Database["public"]["Enums"]["integration_provider"]
          purchases?: number | null
          revenue?: number | null
          sessions?: number | null
          spend?: number
          users_count?: number | null
          workspace_id: string
        }
        Update: {
          account_id?: string
          clicks?: number | null
          client_id?: string | null
          conversions?: number | null
          created_at?: string
          currency?: string
          date?: string
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["entity_type"]
          id?: string
          impressions?: number | null
          notes?: Json | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          purchases?: number | null
          revenue?: number | null
          sessions?: number | null
          spend?: number
          users_count?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_daily_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      risk_events: {
        Row: {
          code: string
          created_at: string
          id: string
          message: string
          metadata_json: Json | null
          provider: string
          severity: string
          workspace_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          message: string
          metadata_json?: Json | null
          provider: string
          severity?: string
          workspace_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          message?: string
          metadata_json?: Json | null
          provider?: string
          severity?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      segment_daily: {
        Row: {
          clicks: number | null
          client_id: string | null
          created_at: string
          currency: string
          date: string
          id: string
          impressions: number | null
          purchases: number | null
          revenue_ga4: number | null
          revenue_platform: number | null
          segment_id: string
          spend: number
          spend_google: number | null
          spend_meta: number | null
          workspace_id: string
        }
        Insert: {
          clicks?: number | null
          client_id?: string | null
          created_at?: string
          currency?: string
          date: string
          id?: string
          impressions?: number | null
          purchases?: number | null
          revenue_ga4?: number | null
          revenue_platform?: number | null
          segment_id: string
          spend?: number
          spend_google?: number | null
          spend_meta?: number | null
          workspace_id: string
        }
        Update: {
          clicks?: number | null
          client_id?: string | null
          created_at?: string
          currency?: string
          date?: string
          id?: string
          impressions?: number | null
          purchases?: number | null
          revenue_ga4?: number | null
          revenue_platform?: number | null
          segment_id?: string
          spend?: number
          spend_google?: number | null
          spend_meta?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "segment_daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segment_daily_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segment_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      segment_rules: {
        Row: {
          client_id: string | null
          created_at: string
          entity_level: Database["public"]["Enums"]["segment_rule_entity_level"]
          group_id: string
          id: string
          is_inclusive: boolean
          platform: Database["public"]["Enums"]["segment_rule_platform"]
          priority: number
          rule_type: Database["public"]["Enums"]["segment_rule_type"]
          rule_value: string
          segment_id: string
          workspace_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          entity_level?: Database["public"]["Enums"]["segment_rule_entity_level"]
          group_id?: string
          id?: string
          is_inclusive?: boolean
          platform?: Database["public"]["Enums"]["segment_rule_platform"]
          priority?: number
          rule_type: Database["public"]["Enums"]["segment_rule_type"]
          rule_value: string
          segment_id: string
          workspace_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          entity_level?: Database["public"]["Enums"]["segment_rule_entity_level"]
          group_id?: string
          id?: string
          is_inclusive?: boolean
          platform?: Database["public"]["Enums"]["segment_rule_platform"]
          priority?: number
          rule_type?: Database["public"]["Enums"]["segment_rule_type"]
          rule_value?: string
          segment_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "segment_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segment_rules_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segment_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      segments: {
        Row: {
          client_id: string | null
          created_at: string
          currency: string
          id: string
          monthly_budget: number
          name: string
          rolling_avg_days: number
          status: Database["public"]["Enums"]["segment_status"]
          tolerance_percent: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          monthly_budget?: number
          name: string
          rolling_avg_days?: number
          status?: Database["public"]["Enums"]["segment_status"]
          tolerance_percent?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          monthly_budget?: number
          name?: string
          rolling_avg_days?: number
          status?: Database["public"]["Enums"]["segment_status"]
          tolerance_percent?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "segments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_locks: {
        Row: {
          created_at: string
          id: string
          job_name: string
          lock_reason: string | null
          locked_until: string
          provider: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_name: string
          lock_reason?: string | null
          locked_until: string
          provider: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_name?: string
          lock_reason?: string | null
          locked_until?: string
          provider?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_locks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          client_id: string | null
          details: Json | null
          ended_at: string | null
          error_code: string | null
          error_message: string | null
          id: string
          integration_id: string | null
          items_upserted: number | null
          job_name: string
          provider: Database["public"]["Enums"]["integration_provider"]
          retry_count: number | null
          started_at: string
          status: Database["public"]["Enums"]["sync_status"]
          triggered_by: Database["public"]["Enums"]["sync_trigger"] | null
          triggered_user_id: string | null
          workspace_id: string
        }
        Insert: {
          client_id?: string | null
          details?: Json | null
          ended_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          integration_id?: string | null
          items_upserted?: number | null
          job_name: string
          provider: Database["public"]["Enums"]["integration_provider"]
          retry_count?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["sync_status"]
          triggered_by?: Database["public"]["Enums"]["sync_trigger"] | null
          triggered_user_id?: string | null
          workspace_id: string
        }
        Update: {
          client_id?: string | null
          details?: Json | null
          ended_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          integration_id?: string | null
          items_upserted?: number | null
          job_name?: string
          provider?: Database["public"]["Enums"]["integration_provider"]
          retry_count?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["sync_status"]
          triggered_by?: Database["public"]["Enums"]["sync_trigger"] | null
          triggered_user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_runs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      workspace_account_settings: {
        Row: {
          account_name: string
          created_at: string
          external_group_id: string | null
          external_group_name: string | null
          external_id: string
          id: string
          is_enabled: boolean
          provider: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_name?: string
          created_at?: string
          external_group_id?: string | null
          external_group_name?: string | null
          external_id: string
          id?: string
          is_enabled?: boolean
          provider: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_name?: string
          created_at?: string
          external_group_id?: string | null
          external_group_name?: string | null
          external_id?: string
          id?: string
          is_enabled?: boolean
          provider?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_account_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_financial_settings: {
        Row: {
          avg_cogs_percent: number
          created_at: string
          id: string
          iva_percent: number
          payment_fee_percent: number
          refund_percent: number
          shipping_percent: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          avg_cogs_percent?: number
          created_at?: string
          id?: string
          iva_percent?: number
          payment_fee_percent?: number
          refund_percent?: number
          shipping_percent?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          avg_cogs_percent?: number
          created_at?: string
          id?: string
          iva_percent?: number
          payment_fee_percent?: number
          refund_percent?: number
          shipping_percent?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_financial_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_health: {
        Row: {
          client_id: string | null
          computed_at: string
          penalties: Json
          score: number
          status: string
          workspace_id: string
        }
        Insert: {
          client_id?: string | null
          computed_at?: string
          penalties?: Json
          score?: number
          status?: string
          workspace_id: string
        }
        Update: {
          client_id?: string | null
          computed_at?: string
          penalties?: Json
          score?: number
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_health_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_health_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["workspace_member_status"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["workspace_member_status"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["workspace_member_status"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_revenue_daily: {
        Row: {
          client_id: string | null
          created_at: string
          currency: string
          date: string
          source_breakdown: Json
          total_purchases: number
          total_revenue: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          currency?: string
          date: string
          source_breakdown?: Json
          total_purchases?: number
          total_revenue?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          currency?: string
          date?: string
          source_breakdown?: Json
          total_purchases?: number
          total_revenue?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_revenue_daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_revenue_daily_workspace_id_fkey"
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
          currency: string
          id: string
          monthly_budget: number | null
          name: string
          status: Database["public"]["Enums"]["workspace_status"]
          timezone: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          monthly_budget?: number | null
          name: string
          status?: Database["public"]["Enums"]["workspace_status"]
          timezone?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          monthly_budget?: number | null
          name?: string
          status?: Database["public"]["Enums"]["workspace_status"]
          timezone?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_workspace_role: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_client_member: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      is_workspace_admin: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      account_status: "active" | "disabled"
      alert_entity_scope:
        | "workspace"
        | "account"
        | "campaign"
        | "adset"
        | "ad"
        | "creative"
      alert_rule_type: "pacing" | "anomaly" | "health"
      alert_severity: "info" | "warn" | "critical"
      app_role: "admin" | "analyst" | "viewer"
      asset_type: "video" | "image" | "other"
      change_type:
        | "budget"
        | "targeting"
        | "creative"
        | "landing"
        | "bidding"
        | "tracking"
        | "other"
      changelog_entity_type:
        | "campaign"
        | "adset"
        | "ad"
        | "creative"
        | "landing"
      changelog_status: "planned" | "applied" | "reverted"
      cost_type:
        | "cogs"
        | "shipping"
        | "platform_fees"
        | "taxes"
        | "fulfillment"
        | "other"
      creative_type: "video" | "image" | "carousel" | "text" | "other"
      entity_type:
        | "account"
        | "campaign"
        | "adset"
        | "ad"
        | "creative"
        | "platform_total"
      experiment_decision: "scale" | "iterate" | "stop" | "unknown"
      experiment_status: "planned" | "running" | "done" | "killed"
      identity_confidence: "high" | "medium" | "low"
      integration_provider: "meta" | "google_ads" | "ga4"
      integration_status: "connected" | "degraded" | "disconnected"
      revenue_source: "shopify" | "manual" | "csv" | "erp"
      segment_match_status: "assigned" | "unassigned" | "conflict"
      segment_rule_entity_level: "campaign"
      segment_rule_platform: "meta" | "google_ads" | "any"
      segment_rule_type: "contains" | "starts_with" | "regex" | "in_list"
      segment_status: "active" | "inactive"
      sync_status: "running" | "success" | "partial" | "error"
      sync_trigger: "cron" | "manual"
      workspace_member_status: "active" | "invited" | "disabled"
      workspace_status: "active" | "paused"
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
      account_status: ["active", "disabled"],
      alert_entity_scope: [
        "workspace",
        "account",
        "campaign",
        "adset",
        "ad",
        "creative",
      ],
      alert_rule_type: ["pacing", "anomaly", "health"],
      alert_severity: ["info", "warn", "critical"],
      app_role: ["admin", "analyst", "viewer"],
      asset_type: ["video", "image", "other"],
      change_type: [
        "budget",
        "targeting",
        "creative",
        "landing",
        "bidding",
        "tracking",
        "other",
      ],
      changelog_entity_type: ["campaign", "adset", "ad", "creative", "landing"],
      changelog_status: ["planned", "applied", "reverted"],
      cost_type: [
        "cogs",
        "shipping",
        "platform_fees",
        "taxes",
        "fulfillment",
        "other",
      ],
      creative_type: ["video", "image", "carousel", "text", "other"],
      entity_type: [
        "account",
        "campaign",
        "adset",
        "ad",
        "creative",
        "platform_total",
      ],
      experiment_decision: ["scale", "iterate", "stop", "unknown"],
      experiment_status: ["planned", "running", "done", "killed"],
      identity_confidence: ["high", "medium", "low"],
      integration_provider: ["meta", "google_ads", "ga4"],
      integration_status: ["connected", "degraded", "disconnected"],
      revenue_source: ["shopify", "manual", "csv", "erp"],
      segment_match_status: ["assigned", "unassigned", "conflict"],
      segment_rule_entity_level: ["campaign"],
      segment_rule_platform: ["meta", "google_ads", "any"],
      segment_rule_type: ["contains", "starts_with", "regex", "in_list"],
      segment_status: ["active", "inactive"],
      sync_status: ["running", "success", "partial", "error"],
      sync_trigger: ["cron", "manual"],
      workspace_member_status: ["active", "invited", "disabled"],
      workspace_status: ["active", "paused"],
    },
  },
} as const
