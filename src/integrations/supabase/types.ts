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
      campaign_segment_map: {
        Row: {
          account_id: string
          campaign_id: string
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
          created_at: string
          decision: Database["public"]["Enums"]["experiment_decision"] | null
          end_date: string | null
          hypothesis: string
          id: string
          linked_changelog_id: string | null
          metric_primary: string
          owner_id: string
          result_summary: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["experiment_status"]
          workspace_id: string
        }
        Insert: {
          created_at?: string
          decision?: Database["public"]["Enums"]["experiment_decision"] | null
          end_date?: string | null
          hypothesis: string
          id?: string
          linked_changelog_id?: string | null
          metric_primary?: string
          owner_id: string
          result_summary?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["experiment_status"]
          workspace_id: string
        }
        Update: {
          created_at?: string
          decision?: Database["public"]["Enums"]["experiment_decision"] | null
          end_date?: string | null
          hypothesis?: string
          id?: string
          linked_changelog_id?: string | null
          metric_primary?: string
          owner_id?: string
          result_summary?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["experiment_status"]
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
      performance_daily: {
        Row: {
          account_id: string
          clicks: number | null
          conversions: number | null
          created_at: string
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
          conversions?: number | null
          created_at?: string
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
          conversions?: number | null
          created_at?: string
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
          created_at: string
          entity_level: Database["public"]["Enums"]["segment_rule_entity_level"]
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
          created_at?: string
          entity_level?: Database["public"]["Enums"]["segment_rule_entity_level"]
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
          created_at?: string
          entity_level?: Database["public"]["Enums"]["segment_rule_entity_level"]
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
