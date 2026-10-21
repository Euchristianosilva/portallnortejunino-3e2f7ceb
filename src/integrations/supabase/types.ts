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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          published: boolean
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity: string
          entity_id?: string | null
          id?: number
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          id?: number
        }
        Relationships: []
      }
      consent_events: {
        Row: {
          actor_id: string | null
          created_at: string
          document_version_id: string
          event: string
          id: number
          opportunity_id: string
          registration_id: string | null
          session_hash: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          document_version_id: string
          event: string
          id?: never
          opportunity_id: string
          registration_id?: string | null
          session_hash: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          document_version_id?: string
          event?: string
          id?: never
          opportunity_id?: string
          registration_id?: string | null
          session_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_events_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "legal_document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_events_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_events_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          handled: boolean
          id: string
          message: string
          name: string
        }
        Insert: {
          created_at?: string
          email: string
          handled?: boolean
          id?: string
          message: string
          name: string
        }
        Update: {
          created_at?: string
          email?: string
          handled?: boolean
          id?: string
          message?: string
          name?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          description: string
          id: string
          location: string
          published: boolean
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          location?: string
          published?: boolean
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          location?: string
          published?: boolean
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      form_versions: {
        Row: {
          created_at: string
          fields: Json
          form_id: string
          title: string
          version: number
        }
        Insert: {
          created_at?: string
          fields: Json
          form_id: string
          title: string
          version: number
        }
        Update: {
          created_at?: string
          fields?: Json
          form_id?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_versions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "registration_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_document_versions: {
        Row: {
          body: string
          created_at: string
          document_id: string
          id: string
          published: boolean
          published_at: string | null
          title: string
          version: number
        }
        Insert: {
          body: string
          created_at?: string
          document_id: string
          id?: string
          published?: boolean
          published_at?: string | null
          title: string
          version: number
        }
        Update: {
          body?: string
          created_at?: string
          document_id?: string
          id?: string
          published?: boolean
          published_at?: string | null
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "legal_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          active_version: number
          created_at: string
          id: string
          kind: string
          legal_blockers: Json
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          active_version?: number
          created_at?: string
          id?: string
          kind?: string
          legal_blockers?: Json
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          active_version?: number
          created_at?: string
          id?: string
          kind?: string
          legal_blockers?: Json
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      lookup_attempts: {
        Row: {
          created_at: string
          id: number
          ip: string
        }
        Insert: {
          created_at?: string
          id?: number
          ip: string
        }
        Update: {
          created_at?: string
          id?: number
          ip?: string
        }
        Relationships: []
      }
      offboarding_attempts: {
        Row: {
          attempts: number
          ip_hash: string
          window_start: string
        }
        Insert: {
          attempts?: number
          ip_hash: string
          window_start: string
        }
        Update: {
          attempts?: number
          ip_hash?: string
          window_start?: string
        }
        Relationships: []
      }
      offboarding_requests: {
        Row: {
          admin_note: string
          completed_at: string | null
          contact_email: string | null
          created_at: string
          created_by: string | null
          declaration: boolean
          expires_at: string
          full_name: string | null
          id: string
          reason: string | null
          role_label: string
          state: string
          status: string
          submitted_at: string | null
          token_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string
          completed_at?: string | null
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          declaration?: boolean
          expires_at: string
          full_name?: string | null
          id?: string
          reason?: string | null
          role_label: string
          state?: string
          status?: string
          submitted_at?: string | null
          token_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string
          completed_at?: string | null
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          declaration?: boolean
          expires_at?: string
          full_name?: string | null
          id?: string
          reason?: string | null
          role_label?: string
          state?: string
          status?: string
          submitted_at?: string | null
          token_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offboarding_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offboarding_settings: {
        Row: {
          description: string
          id: boolean
          reason_options: Json
          title: string
          updated_at: string
        }
        Insert: {
          description?: string
          id?: boolean
          reason_options?: Json
          title?: string
          updated_at?: string
        }
        Update: {
          description?: string
          id?: boolean
          reason_options?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          activities: string
          benefits: string
          category: string
          city: string
          closes_at: string | null
          created_at: string
          created_by: string | null
          dedication: string
          description: string
          form_id: string | null
          id: string
          image_url: string | null
          modality: string
          modality_label: string
          opens_at: string | null
          profile: string
          project: string
          requirements: string
          seats: number | null
          selection_criteria: string
          state: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          activities?: string
          benefits?: string
          category?: string
          city?: string
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          dedication?: string
          description?: string
          form_id?: string | null
          id?: string
          image_url?: string | null
          modality?: string
          modality_label?: string
          opens_at?: string | null
          profile?: string
          project?: string
          requirements?: string
          seats?: number | null
          selection_criteria?: string
          state?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          activities?: string
          benefits?: string
          category?: string
          city?: string
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          dedication?: string
          description?: string
          form_id?: string | null
          id?: string
          image_url?: string | null
          modality?: string
          modality_label?: string
          opens_at?: string | null
          profile?: string
          project?: string
          requirements?: string
          seats?: number | null
          selection_criteria?: string
          state?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "registration_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_documents: {
        Row: {
          document_id: string
          id: string
          image_choice: boolean
          opportunity_id: string
          position: number
          required: boolean
          version_id: string
        }
        Insert: {
          document_id: string
          id?: string
          image_choice?: boolean
          opportunity_id: string
          position?: number
          required?: boolean
          version_id: string
        }
        Update: {
          document_id?: string
          id?: string
          image_choice?: boolean
          opportunity_id?: string
          position?: number
          required?: boolean
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_documents_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_documents_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "legal_document_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_options: {
        Row: {
          active: boolean
          artistic_name: string
          city: string
          code: string
          created_at: string
          description: string
          group_name: string
          id: string
          image_url: string | null
          name: string
          poll_id: string
          position: number
          social_links: Json
          state: string
        }
        Insert: {
          active?: boolean
          artistic_name?: string
          city?: string
          code?: string
          created_at?: string
          description?: string
          group_name?: string
          id?: string
          image_url?: string | null
          name: string
          poll_id: string
          position?: number
          social_links?: Json
          state?: string
        }
        Update: {
          active?: boolean
          artistic_name?: string
          city?: string
          code?: string
          created_at?: string
          description?: string
          group_name?: string
          id?: string
          image_url?: string | null
          name?: string
          poll_id?: string
          position?: number
          social_links?: Json
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_participation: {
        Row: {
          poll_id: string
          updated_at: string
          voters: number
        }
        Insert: {
          poll_id: string
          updated_at?: string
          voters?: number
        }
        Update: {
          poll_id?: string
          updated_at?: string
          voters?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_participation_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: true
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_tallies: {
        Row: {
          option_id: string
          poll_id: string
          updated_at: string
          votes: number
        }
        Insert: {
          option_id: string
          poll_id: string
          updated_at?: string
          votes?: number
        }
        Update: {
          option_id?: string
          poll_id?: string
          updated_at?: string
          votes?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_tallies_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: true
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_tallies_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_voters: {
        Row: {
          email: string
          poll_id: string
        }
        Insert: {
          email: string
          poll_id: string
        }
        Update: {
          email?: string
          poll_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_voters_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          allow_repeat_option: boolean
          audience: Database["public"]["Enums"]["poll_audience"]
          category: string
          created_at: string
          created_by: string | null
          description: string
          ends_at: string | null
          id: string
          image_url: string | null
          project: string
          results_visibility: Database["public"]["Enums"]["results_visibility"]
          rules: string
          starts_at: string | null
          status: Database["public"]["Enums"]["poll_status"]
          title: string
          updated_at: string
          votes_per_user: number
        }
        Insert: {
          allow_repeat_option?: boolean
          audience?: Database["public"]["Enums"]["poll_audience"]
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          project?: string
          results_visibility?: Database["public"]["Enums"]["results_visibility"]
          rules?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["poll_status"]
          title: string
          updated_at?: string
          votes_per_user?: number
        }
        Update: {
          allow_repeat_option?: boolean
          audience?: Database["public"]["Enums"]["poll_audience"]
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          project?: string
          results_visibility?: Database["public"]["Enums"]["results_visibility"]
          rules?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["poll_status"]
          title?: string
          updated_at?: string
          votes_per_user?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          state: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      registration_dossier_access: {
        Row: {
          expires_at: string
          id: string
          registration_id: string
          requests: number
          token_hash: string
        }
        Insert: {
          expires_at?: string
          id?: string
          registration_id: string
          requests?: number
          token_hash: string
        }
        Update: {
          expires_at?: string
          id?: string
          registration_id?: string
          requests?: number
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_dossier_access_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_dossiers: {
        Row: {
          generated_at: string
          hash: string
          id: string
          registration_id: string
          snapshot: Json
        }
        Insert: {
          generated_at?: string
          hash: string
          id?: string
          registration_id: string
          snapshot: Json
        }
        Update: {
          generated_at?: string
          hash?: string
          id?: string
          registration_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "registration_dossiers_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_forms: {
        Row: {
          category: string
          closes_at: string | null
          created_at: string
          created_by: string | null
          description: string
          fields: Json
          id: string
          image_url: string | null
          legal_documents: Json
          opens_at: string | null
          published: boolean
          require_login: boolean
          title: string
          unique_per_email: boolean
          updated_at: string
          version: number
        }
        Insert: {
          category?: string
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          fields?: Json
          id?: string
          image_url?: string | null
          legal_documents?: Json
          opens_at?: string | null
          published?: boolean
          require_login?: boolean
          title: string
          unique_per_email?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          category?: string
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          fields?: Json
          id?: string
          image_url?: string | null
          legal_documents?: Json
          opens_at?: string | null
          published?: boolean
          require_login?: boolean
          title?: string
          unique_per_email?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      registration_live_status: {
        Row: {
          status: Database["public"]["Enums"]["reg_status"]
          tracking_token: string
          updated_at: string
        }
        Insert: {
          status: Database["public"]["Enums"]["reg_status"]
          tracking_token: string
          updated_at?: string
        }
        Update: {
          status?: Database["public"]["Enums"]["reg_status"]
          tracking_token?: string
          updated_at?: string
        }
        Relationships: []
      }
      registration_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: number
          note: string | null
          registration_id: string
          status: Database["public"]["Enums"]["reg_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: number
          note?: string | null
          registration_id: string
          status: Database["public"]["Enums"]["reg_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: number
          note?: string | null
          registration_id?: string
          status?: Database["public"]["Enums"]["reg_status"]
        }
        Relationships: [
          {
            foreignKeyName: "registration_status_history_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          answers: Json
          consent_snapshot: Json
          created_at: string
          email: string
          fields_snapshot: Json
          form_id: string
          form_version: number
          full_name: string
          id: string
          opportunity_id: string | null
          protocol: string
          public_note: string | null
          status: Database["public"]["Enums"]["reg_status"]
          submission_snapshot: Json | null
          tracking_token: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          answers?: Json
          consent_snapshot?: Json
          created_at?: string
          email: string
          fields_snapshot?: Json
          form_id: string
          form_version?: number
          full_name: string
          id?: string
          opportunity_id?: string | null
          protocol: string
          public_note?: string | null
          status?: Database["public"]["Enums"]["reg_status"]
          submission_snapshot?: Json | null
          tracking_token?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          answers?: Json
          consent_snapshot?: Json
          created_at?: string
          email?: string
          fields_snapshot?: Json
          form_id?: string
          form_version?: number
          full_name?: string
          id?: string
          opportunity_id?: string | null
          protocol?: string
          public_note?: string | null
          status?: Database["public"]["Enums"]["reg_status"]
          submission_snapshot?: Json | null
          tracking_token?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "registration_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          permission: Database["public"]["Enums"]["admin_permission"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission: Database["public"]["Enums"]["admin_permission"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["admin_permission"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      votes: {
        Row: {
          created_at: string
          id: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      access_offboarding: {
        Args: { _ip: string; _submission?: Json; _token: string }
        Returns: Json
      }
      admin_registration_dossier_source: {
        Args: { _id: string }
        Returns: Json
      }
      audit_registration_dossier: {
        Args: { _action: string; _generation_id: string; _id: string }
        Returns: undefined
      }
      authorize_registration_dossier: {
        Args: { _protocol: string }
        Returns: string
      }
      cast_vote: {
        Args: { _option_ids: string[]; _poll_id: string }
        Returns: number
      }
      check_dossier_request: { Args: { _token_hash: string }; Returns: boolean }
      create_offboarding_invite: {
        Args: { _days: number; _user_id: string }
        Returns: Json
      }
      dossier_source_by_registration: { Args: { _id: string }; Returns: Json }
      has_permission: {
        Args: {
          _perm: Database["public"]["Enums"]["admin_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      list_public_opportunities: {
        Args: never
        Returns: {
          activities: string
          benefits: string
          category: string
          city: string
          closes_at: string | null
          created_at: string
          created_by: string | null
          dedication: string
          description: string
          form_id: string | null
          id: string
          image_url: string | null
          modality: string
          modality_label: string
          opens_at: string | null
          profile: string
          project: string
          requirements: string
          seats: number | null
          selection_criteria: string
          state: string
          status: string
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "opportunities"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      lookup_by_token: {
        Args: { _token: string }
        Returns: {
          created_at: string
          form_title: string
          full_name: string
          protocol: string
          public_note: string
          status: Database["public"]["Enums"]["reg_status"]
          tracking_token: string
          updated_at: string
        }[]
      }
      lookup_registration: {
        Args: { _email: string; _ip: string; _protocol: string }
        Returns: {
          created_at: string
          form_title: string
          full_name: string
          protocol: string
          public_note: string
          status: Database["public"]["Enums"]["reg_status"]
          tracking_token: string
          updated_at: string
        }[]
      }
      opportunity_gate: {
        Args: { _opportunity_id: string; _session: string }
        Returns: Json
      }
      opportunity_public_source: { Args: { _id: string }; Returns: Json }
      portal_report: {
        Args: {
          _category?: string
          _from?: string
          _kind: string
          _status?: string
          _to?: string
        }
        Returns: Json
      }
      publish_legal_version: {
        Args: { _document_id: string; _version: number }
        Returns: undefined
      }
      record_consent: {
        Args: { _events: Json; _opportunity_id: string; _session: string }
        Returns: undefined
      }
      registration_dossier_source: {
        Args: { _token_hash: string }
        Returns: Json
      }
      save_opportunity: {
        Args: {
          _expected_updated_at: string
          _id: string
          _links: Json
          _values: Json
        }
        Returns: string
      }
      submit_opportunity_registration: {
        Args: {
          _answers: Json
          _email: string
          _full_name: string
          _opportunity_id: string
          _session: string
        }
        Returns: {
          document_token: string
          protocol: string
          registration_id: string
        }[]
      }
      submit_registration: {
        Args: {
          _answers: Json
          _email: string
          _form_id: string
          _full_name: string
        }
        Returns: {
          protocol: string
          registration_id: string
        }[]
      }
      submit_registration_with_dossier: {
        Args: {
          _answers: Json
          _email: string
          _form_id: string
          _full_name: string
        }
        Returns: {
          document_token: string
          protocol: string
          registration_id: string
        }[]
      }
      update_offboarding: {
        Args: {
          _expected_updated_at: string
          _id: string
          _note: string
          _status: string
        }
        Returns: undefined
      }
      update_registration_status: {
        Args: {
          _expected_updated_at: string
          _id: string
          _note: string
          _public_note: string
          _status: Database["public"]["Enums"]["reg_status"]
        }
        Returns: string
      }
    }
    Enums: {
      admin_permission: "registrations" | "polls" | "announcements" | "forms"
      app_role: "master" | "coordenacao" | "operador" | "user"
      poll_audience: "publica" | "restrita"
      poll_status: "rascunho" | "agendada" | "ativa" | "encerrada" | "cancelada"
      reg_status:
        | "recebida"
        | "em_analise"
        | "info_solicitada"
        | "aprovada"
        | "nao_aprovada"
      results_visibility: "oculto" | "ao_vivo" | "apos_encerramento"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      admin_permission: ["registrations", "polls", "announcements", "forms"],
      app_role: ["master", "coordenacao", "operador", "user"],
      poll_audience: ["publica", "restrita"],
      poll_status: ["rascunho", "agendada", "ativa", "encerrada", "cancelada"],
      reg_status: [
        "recebida",
        "em_analise",
        "info_solicitada",
        "aprovada",
        "nao_aprovada",
      ],
      results_visibility: ["oculto", "ao_vivo", "apos_encerramento"],
    },
  },
} as const
