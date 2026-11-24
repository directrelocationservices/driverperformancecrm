export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          after: Json | null;
          before: Json | null;
          changed_at: string;
          changed_by: string | null;
          entity_id: string;
          entity_type: string;
          id: string;
          job_id: string | null;
          reason: string | null;
        };
        Insert: {
          action: string;
          after?: Json | null;
          before?: Json | null;
          changed_at?: string;
          changed_by?: string | null;
          entity_id: string;
          entity_type: string;
          id?: string;
          job_id?: string | null;
          reason?: string | null;
        };
        Update: {
          action?: string;
          after?: Json | null;
          before?: Json | null;
          changed_at?: string;
          changed_by?: string | null;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          job_id?: string | null;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      carrier_claim_notes: {
        Row: {
          claim_id: string;
          created_at: string;
          created_by: string | null;
          file_names: string[];
          file_paths: string[];
          id: string;
          internal: boolean;
          note: string;
        };
        Insert: {
          claim_id: string;
          created_at?: string;
          created_by?: string | null;
          file_names?: string[];
          file_paths?: string[];
          id?: string;
          internal?: boolean;
          note: string;
        };
        Update: {
          claim_id?: string;
          created_at?: string;
          created_by?: string | null;
          file_names?: string[];
          file_paths?: string[];
          id?: string;
          internal?: boolean;
          note?: string;
        };
        Relationships: [
          {
            foreignKeyName: "carrier_claim_notes_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "carrier_claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_claim_notes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      carrier_claims: {
        Row: {
          carrier_id: string;
          charged_back_amount: number;
          claim_amount: number;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string;
          id: string;
          item: string;
          job_id: string;
          paid_amount: number;
          photo_paths: string[];
          status: string;
          updated_at: string;
        };
        Insert: {
          carrier_id: string;
          charged_back_amount?: number;
          claim_amount?: number;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description: string;
          id?: string;
          item: string;
          job_id: string;
          paid_amount?: number;
          photo_paths?: string[];
          status?: string;
          updated_at?: string;
        };
        Update: {
          carrier_id?: string;
          charged_back_amount?: number;
          claim_amount?: number;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string;
          id?: string;
          item?: string;
          job_id?: string;
          paid_amount?: number;
          photo_paths?: string[];
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "carrier_claims_carrier_id_fkey";
            columns: ["carrier_id"];
            isOneToOne: false;
            referencedRelation: "carriers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_claims_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_claims_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      carriers: {
        Row: {
          active: boolean;
          company_name: string;
          contact_email: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          insurance_alert_sent_for: string | null;
          insurance_expires: string | null;
          insurance_file_name: string | null;
          insurance_path: string | null;
          mc_number: string | null;
          notes: string | null;
          updated_at: string;
          usdot: string | null;
        };
        Insert: {
          active?: boolean;
          company_name: string;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          insurance_alert_sent_for?: string | null;
          insurance_expires?: string | null;
          insurance_file_name?: string | null;
          insurance_path?: string | null;
          mc_number?: string | null;
          notes?: string | null;
          updated_at?: string;
          usdot?: string | null;
        };
        Update: {
          active?: boolean;
          company_name?: string;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          insurance_alert_sent_for?: string | null;
          insurance_expires?: string | null;
          insurance_file_name?: string | null;
          insurance_path?: string | null;
          mc_number?: string | null;
          notes?: string | null;
          updated_at?: string;
          usdot?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "carriers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      damage_incidents: {
        Row: {
          attributed_driver_id: string | null;
          attributed_to: string | null;
          carrier_id: string | null;
          claim_filed: boolean;
          created_at: string;
          created_by: string | null;
          damage_date: string | null;
          deleted_at: string | null;
          description: string;
          estimated_cost: number;
          id: string;
          item: string;
          job_id: string;
          photo_paths: string[];
          reported_by: string | null;
          reported_on: string | null;
          source: string;
        };
        Insert: {
          attributed_driver_id?: string | null;
          attributed_to?: string | null;
          carrier_id?: string | null;
          claim_filed: boolean;
          created_at?: string;
          created_by?: string | null;
          damage_date?: string | null;
          deleted_at?: string | null;
          description: string;
          estimated_cost: number;
          id?: string;
          item: string;
          job_id: string;
          photo_paths: string[];
          reported_by?: string | null;
          reported_on?: string | null;
          source?: string;
        };
        Update: {
          attributed_driver_id?: string | null;
          attributed_to?: string | null;
          carrier_id?: string | null;
          claim_filed?: boolean;
          created_at?: string;
          created_by?: string | null;
          damage_date?: string | null;
          deleted_at?: string | null;
          description?: string;
          estimated_cost?: number;
          id?: string;
          item?: string;
          job_id?: string;
          photo_paths?: string[];
          reported_by?: string | null;
          reported_on?: string | null;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "damage_incidents_attributed_driver_id_fkey";
            columns: ["attributed_driver_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "damage_incidents_carrier_id_fkey";
            columns: ["carrier_id"];
            isOneToOne: false;
            referencedRelation: "carriers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "damage_incidents_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "damage_incidents_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "damage_incidents_reported_by_fkey";
            columns: ["reported_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      damage_notes: {
        Row: {
          created_at: string;
          created_by: string | null;
          damage_id: string;
          id: string;
          job_id: string;
          note: string;
          photo_paths: string[];
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          damage_id: string;
          id?: string;
          job_id: string;
          note: string;
          photo_paths?: string[];
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          damage_id?: string;
          id?: string;
          job_id?: string;
          note?: string;
          photo_paths?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "damage_notes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "damage_notes_damage_id_fkey";
            columns: ["damage_id"];
            isOneToOne: false;
            referencedRelation: "damage_incidents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "damage_notes_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      granot_events: {
        Row: {
          event_type: string;
          id: string;
          job_number: string | null;
          lead_id: string | null;
          message: string | null;
          payload: Json;
          received_at: string;
          status: string;
        };
        Insert: {
          event_type: string;
          id?: string;
          job_number?: string | null;
          lead_id?: string | null;
          message?: string | null;
          payload: Json;
          received_at?: string;
          status?: string;
        };
        Update: {
          event_type?: string;
          id?: string;
          job_number?: string | null;
          lead_id?: string | null;
          message?: string | null;
          payload?: Json;
          received_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "granot_events_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      job_documents: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          job_id: string;
          kind: string;
          name: string;
          path: string;
          uploaded_by: string | null;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          job_id: string;
          kind: string;
          name: string;
          path: string;
          uploaded_by?: string | null;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          job_id?: string;
          kind?: string;
          name?: string;
          path?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "job_documents_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: {
          carrier_id: string | null;
          created_at: string;
          crew_ids: string[];
          customer_name: string | null;
          date: string;
          delivered_by: Database["public"]["Enums"]["delivered_by"];
          delivery_date: string | null;
          dest_city: string;
          dest_state: string;
          driver_id: string;
          entered_by: string | null;
          id: string;
          import_batch: string | null;
          job_number: string;
          on_time_delivery: boolean | null;
          on_time_pickup: boolean | null;
          origin_city: string;
          origin_state: string;
        };
        Insert: {
          carrier_id?: string | null;
          created_at?: string;
          crew_ids?: string[];
          customer_name?: string | null;
          date: string;
          delivered_by?: Database["public"]["Enums"]["delivered_by"];
          delivery_date?: string | null;
          dest_city: string;
          dest_state: string;
          driver_id: string;
          entered_by?: string | null;
          id?: string;
          import_batch?: string | null;
          job_number: string;
          on_time_delivery?: boolean | null;
          on_time_pickup?: boolean | null;
          origin_city: string;
          origin_state: string;
        };
        Update: {
          carrier_id?: string | null;
          created_at?: string;
          crew_ids?: string[];
          customer_name?: string | null;
          date?: string;
          delivered_by?: Database["public"]["Enums"]["delivered_by"];
          delivery_date?: string | null;
          dest_city?: string;
          dest_state?: string;
          driver_id?: string;
          entered_by?: string | null;
          id?: string;
          import_batch?: string | null;
          job_number?: string;
          on_time_delivery?: boolean | null;
          on_time_pickup?: boolean | null;
          origin_city?: string;
          origin_state?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_carrier_id_fkey";
            columns: ["carrier_id"];
            isOneToOne: false;
            referencedRelation: "carriers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_entered_by_fkey";
            columns: ["entered_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_cost_range_log: {
        Row: {
          action: string;
          after: Json | null;
          before: Json | null;
          changed_at: string;
          changed_by: string | null;
          id: string;
          range_id: string;
          source_id: string;
        };
        Insert: {
          action: string;
          after?: Json | null;
          before?: Json | null;
          changed_at?: string;
          changed_by?: string | null;
          id?: string;
          range_id: string;
          source_id: string;
        };
        Update: {
          action?: string;
          after?: Json | null;
          before?: Json | null;
          changed_at?: string;
          changed_by?: string | null;
          id?: string;
          range_id?: string;
          source_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_cost_range_log_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_cost_range_log_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "lead_sources";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_cost_ranges: {
        Row: {
          amount: number;
          cost_per_lead: number;
          created_at: string;
          created_by: string | null;
          end_date: string;
          id: string;
          lead_count: number;
          mode: string;
          note: string | null;
          source_id: string;
          start_date: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          amount: number;
          cost_per_lead?: number;
          created_at?: string;
          created_by?: string | null;
          end_date: string;
          id?: string;
          lead_count?: number;
          mode: string;
          note?: string | null;
          source_id: string;
          start_date: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          amount?: number;
          cost_per_lead?: number;
          created_at?: string;
          created_by?: string | null;
          end_date?: string;
          id?: string;
          lead_count?: number;
          mode?: string;
          note?: string | null;
          source_id?: string;
          start_date?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lead_cost_ranges_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_cost_ranges_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "lead_sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_cost_ranges_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_costs: {
        Row: {
          cost: number;
          id: string;
          source_id: string;
          updated_at: string;
          week: string;
        };
        Insert: {
          cost: number;
          id?: string;
          source_id: string;
          updated_at?: string;
          week: string;
        };
        Update: {
          cost?: number;
          id?: string;
          source_id?: string;
          updated_at?: string;
          week?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_costs_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "lead_sources";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_sources: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          booked_date: string | null;
          cost_overridden: boolean;
          created_at: string;
          date: string;
          granot_id: string;
          granot_rep: string | null;
          granot_source: string | null;
          id: string;
          import_batch: string | null;
          is_sample: boolean;
          is_test: boolean | null;
          job_value: number | null;
          lead_cost: number;
          raw: Json | null;
          rep_id: string | null;
          source_id: string;
          status: Database["public"]["Enums"]["lead_status"];
          updated_at: string;
        };
        Insert: {
          booked_date?: string | null;
          cost_overridden?: boolean;
          created_at?: string;
          date: string;
          granot_id: string;
          granot_rep?: string | null;
          granot_source?: string | null;
          id?: string;
          import_batch?: string | null;
          is_sample?: boolean;
          is_test?: boolean | null;
          job_value?: number | null;
          lead_cost?: number;
          raw?: Json | null;
          rep_id?: string | null;
          source_id: string;
          status?: Database["public"]["Enums"]["lead_status"];
          updated_at?: string;
        };
        Update: {
          booked_date?: string | null;
          cost_overridden?: boolean;
          created_at?: string;
          date?: string;
          granot_id?: string;
          granot_rep?: string | null;
          granot_source?: string | null;
          id?: string;
          import_batch?: string | null;
          is_sample?: boolean;
          is_test?: boolean | null;
          job_value?: number | null;
          lead_cost?: number;
          raw?: Json | null;
          rep_id?: string | null;
          source_id?: string;
          status?: Database["public"]["Enums"]["lead_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leads_rep_id_fkey";
            columns: ["rep_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "lead_sources";
            referencedColumns: ["id"];
          },
        ];
      };
      maintenance_tickets: {
        Row: {
          created_at: string;
          driver_id: string;
          fix_note: string | null;
          fixed_on: string | null;
          id: string;
          inspection_id: string;
          item_key: string;
          notes: string | null;
          photo_paths: string[];
          severity: Database["public"]["Enums"]["truck_status"];
          status: Database["public"]["Enums"]["ticket_status"];
          truck_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          driver_id: string;
          fix_note?: string | null;
          fixed_on?: string | null;
          id?: string;
          inspection_id: string;
          item_key: string;
          notes?: string | null;
          photo_paths?: string[];
          severity: Database["public"]["Enums"]["truck_status"];
          status?: Database["public"]["Enums"]["ticket_status"];
          truck_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          driver_id?: string;
          fix_note?: string | null;
          fixed_on?: string | null;
          id?: string;
          inspection_id?: string;
          item_key?: string;
          notes?: string | null;
          photo_paths?: string[];
          severity?: Database["public"]["Enums"]["truck_status"];
          status?: Database["public"]["Enums"]["ticket_status"];
          truck_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_tickets_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_tickets_inspection_id_fkey";
            columns: ["inspection_id"];
            isOneToOne: false;
            referencedRelation: "pre_trips";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_tickets_truck_id_fkey";
            columns: ["truck_id"];
            isOneToOne: false;
            referencedRelation: "trucks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_tickets_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      offload_forms: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          required: boolean;
          sort: number;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          required?: boolean;
          sort?: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          required?: boolean;
          sort?: number;
        };
        Relationships: [];
      };
      offloads: {
        Row: {
          accuracy: number | null;
          address: string | null;
          captured_at_device: string;
          carrier_id: string | null;
          created_by: string | null;
          deleted_at: string | null;
          destination: string;
          forms: Json;
          id: string;
          job_id: string;
          lat: number | null;
          lng: number | null;
          locked: boolean;
          note: string | null;
          photo_paths: string[];
          received_at_server: string;
          storage_address: string | null;
          storage_facility: string | null;
          storage_unit: string | null;
          synced_offline: boolean;
        };
        Insert: {
          accuracy?: number | null;
          address?: string | null;
          captured_at_device: string;
          carrier_id?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          destination: string;
          forms?: Json;
          id?: string;
          job_id: string;
          lat?: number | null;
          lng?: number | null;
          locked?: boolean;
          note?: string | null;
          photo_paths: string[];
          received_at_server?: string;
          storage_address?: string | null;
          storage_facility?: string | null;
          storage_unit?: string | null;
          synced_offline?: boolean;
        };
        Update: {
          accuracy?: number | null;
          address?: string | null;
          captured_at_device?: string;
          carrier_id?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          destination?: string;
          forms?: Json;
          id?: string;
          job_id?: string;
          lat?: number | null;
          lng?: number | null;
          locked?: boolean;
          note?: string | null;
          photo_paths?: string[];
          received_at_server?: string;
          storage_address?: string | null;
          storage_facility?: string | null;
          storage_unit?: string | null;
          synced_offline?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "offloads_carrier_id_fkey";
            columns: ["carrier_id"];
            isOneToOne: false;
            referencedRelation: "carriers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "offloads_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "offloads_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      pre_damages: {
        Row: {
          captured_at_device: string | null;
          created_by: string | null;
          customer_name: string;
          customer_shown: boolean;
          deleted_at: string | null;
          description: string;
          id: string;
          item: string;
          job_id: string;
          lat: number | null;
          lng: number | null;
          location: string;
          locked: boolean;
          notes: string | null;
          office_entered: boolean;
          photo_paths: string[];
          received_at_server: string;
          signature_path: string | null;
          synced_offline: boolean;
        };
        Insert: {
          captured_at_device?: string | null;
          created_by?: string | null;
          customer_name: string;
          customer_shown: boolean;
          deleted_at?: string | null;
          description: string;
          id?: string;
          item: string;
          job_id: string;
          lat?: number | null;
          lng?: number | null;
          location: string;
          locked?: boolean;
          notes?: string | null;
          office_entered?: boolean;
          photo_paths: string[];
          received_at_server?: string;
          signature_path?: string | null;
          synced_offline?: boolean;
        };
        Update: {
          captured_at_device?: string | null;
          created_by?: string | null;
          customer_name?: string;
          customer_shown?: boolean;
          deleted_at?: string | null;
          description?: string;
          id?: string;
          item?: string;
          job_id?: string;
          lat?: number | null;
          lng?: number | null;
          location?: string;
          locked?: boolean;
          notes?: string | null;
          office_entered?: boolean;
          photo_paths?: string[];
          received_at_server?: string;
          signature_path?: string | null;
          synced_offline?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "pre_damages_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pre_damages_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      pre_trips: {
        Row: {
          captured_at_device: string;
          condition_photos: Json;
          driver_id: string;
          id: string;
          items: Json;
          lat: number | null;
          lng: number | null;
          notes: string | null;
          odometer: number;
          received_at_server: string;
          signature_path: string;
          synced_offline: boolean;
          truck_id: string;
          truck_status: Database["public"]["Enums"]["truck_status"];
          wash_photo_path: string | null;
          wash_receipt_path: string | null;
          washed: boolean;
        };
        Insert: {
          captured_at_device: string;
          condition_photos?: Json;
          driver_id: string;
          id?: string;
          items: Json;
          lat?: number | null;
          lng?: number | null;
          notes?: string | null;
          odometer: number;
          received_at_server?: string;
          signature_path: string;
          synced_offline?: boolean;
          truck_id: string;
          truck_status: Database["public"]["Enums"]["truck_status"];
          wash_photo_path?: string | null;
          wash_receipt_path?: string | null;
          washed?: boolean;
        };
        Update: {
          captured_at_device?: string;
          condition_photos?: Json;
          driver_id?: string;
          id?: string;
          items?: Json;
          lat?: number | null;
          lng?: number | null;
          notes?: string | null;
          odometer?: number;
          received_at_server?: string;
          signature_path?: string;
          synced_offline?: boolean;
          truck_id?: string;
          truck_status?: Database["public"]["Enums"]["truck_status"];
          wash_photo_path?: string | null;
          wash_receipt_path?: string | null;
          washed?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "pre_trips_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pre_trips_truck_id_fkey";
            columns: ["truck_id"];
            isOneToOne: false;
            referencedRelation: "trucks";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          active: boolean;
          avatar_url: string | null;
          carrier_id: string | null;
          created_at: string;
          email: string;
          granot_name: string | null;
          id: string;
          must_change_password: boolean;
          name: string;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          avatar_url?: string | null;
          carrier_id?: string | null;
          created_at?: string;
          email: string;
          granot_name?: string | null;
          id: string;
          must_change_password?: boolean;
          name: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          avatar_url?: string | null;
          carrier_id?: string | null;
          created_at?: string;
          email?: string;
          granot_name?: string | null;
          id?: string;
          must_change_password?: boolean;
          name?: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_carrier_id_fkey";
            columns: ["carrier_id"];
            isOneToOne: false;
            referencedRelation: "carriers";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          added_by_admin: boolean;
          counts_for_driver: boolean;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          driver_mentioned: boolean;
          id: string;
          job_id: string;
          link: string | null;
          platform: Database["public"]["Enums"]["review_platform"];
          reason: string | null;
          rep_id: string | null;
          review_date: string | null;
          screenshot_path: string | null;
          stars: number;
          verified: boolean;
        };
        Insert: {
          added_by_admin?: boolean;
          counts_for_driver?: boolean;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          driver_mentioned: boolean;
          id?: string;
          job_id: string;
          link?: string | null;
          platform: Database["public"]["Enums"]["review_platform"];
          reason?: string | null;
          rep_id?: string | null;
          review_date?: string | null;
          screenshot_path?: string | null;
          stars: number;
          verified?: boolean;
        };
        Update: {
          added_by_admin?: boolean;
          counts_for_driver?: boolean;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          driver_mentioned?: boolean;
          id?: string;
          job_id?: string;
          link?: string | null;
          platform?: Database["public"]["Enums"]["review_platform"];
          reason?: string | null;
          rep_id?: string | null;
          review_date?: string | null;
          screenshot_path?: string | null;
          stars?: number;
          verified?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_rep_id_fkey";
            columns: ["rep_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      roadside_inspections: {
        Row: {
          created_at: string;
          date: string;
          driver_id: string;
          id: string;
          location: string;
          logged_by: string | null;
          report_name: string | null;
          report_path: string | null;
          report_type: string | null;
          result: Database["public"]["Enums"]["roadside_result"];
          state: string;
          truck_id: string;
          violation_notes: string | null;
        };
        Insert: {
          created_at?: string;
          date: string;
          driver_id: string;
          id?: string;
          location: string;
          logged_by?: string | null;
          report_name?: string | null;
          report_path?: string | null;
          report_type?: string | null;
          result: Database["public"]["Enums"]["roadside_result"];
          state: string;
          truck_id: string;
          violation_notes?: string | null;
        };
        Update: {
          created_at?: string;
          date?: string;
          driver_id?: string;
          id?: string;
          location?: string;
          logged_by?: string | null;
          report_name?: string | null;
          report_path?: string | null;
          report_type?: string | null;
          result?: Database["public"]["Enums"]["roadside_result"];
          state?: string;
          truck_id?: string;
          violation_notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "roadside_inspections_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roadside_inspections_logged_by_fkey";
            columns: ["logged_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roadside_inspections_truck_id_fkey";
            columns: ["truck_id"];
            isOneToOne: false;
            referencedRelation: "trucks";
            referencedColumns: ["id"];
          },
        ];
      };
      settings: {
        Row: {
          company: Json;
          damage_alert_emails: string[];
          id: number;
          offload_alert_emails: string[];
          sales: Json;
          scoring: Json;
          updated_at: string;
        };
        Insert: {
          company: Json;
          damage_alert_emails?: string[];
          id?: number;
          offload_alert_emails?: string[];
          sales?: Json;
          scoring?: Json;
          updated_at?: string;
        };
        Update: {
          company?: Json;
          damage_alert_emails?: string[];
          id?: number;
          offload_alert_emails?: string[];
          sales?: Json;
          scoring?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      sync_receipts: {
        Row: {
          client_id: string;
          created_at: string;
          result: Json;
          user_id: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          result: Json;
          user_id: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          result?: Json;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sync_receipts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      truck_washes: {
        Row: {
          captured_at_device: string;
          driver_id: string;
          id: string;
          lat: number | null;
          lng: number | null;
          notes: string | null;
          photo_path: string;
          pre_trip_id: string | null;
          receipt_path: string | null;
          received_at_server: string;
          synced_offline: boolean;
          truck_id: string;
        };
        Insert: {
          captured_at_device: string;
          driver_id: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          notes?: string | null;
          photo_path: string;
          pre_trip_id?: string | null;
          receipt_path?: string | null;
          received_at_server?: string;
          synced_offline?: boolean;
          truck_id: string;
        };
        Update: {
          captured_at_device?: string;
          driver_id?: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          notes?: string | null;
          photo_path?: string;
          pre_trip_id?: string | null;
          receipt_path?: string | null;
          received_at_server?: string;
          synced_offline?: boolean;
          truck_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "truck_washes_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "truck_washes_pre_trip_id_fkey";
            columns: ["pre_trip_id"];
            isOneToOne: true;
            referencedRelation: "pre_trips";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "truck_washes_truck_id_fkey";
            columns: ["truck_id"];
            isOneToOne: false;
            referencedRelation: "trucks";
            referencedColumns: ["id"];
          },
        ];
      };
      trucks: {
        Row: {
          active: boolean;
          assigned_driver_id: string | null;
          created_at: string;
          description: string | null;
          id: string;
          last_inspection_at: string | null;
          last_washed_at: string | null;
          odometer: number | null;
          plate: string | null;
          status: Database["public"]["Enums"]["truck_status"];
          unit_number: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          assigned_driver_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          last_inspection_at?: string | null;
          last_washed_at?: string | null;
          odometer?: number | null;
          plate?: string | null;
          status?: Database["public"]["Enums"]["truck_status"];
          unit_number: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          assigned_driver_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          last_inspection_at?: string | null;
          last_washed_at?: string | null;
          odometer?: number | null;
          plate?: string | null;
          status?: Database["public"]["Enums"]["truck_status"];
          unit_number?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trucks_assigned_driver_id_fkey";
            columns: ["assigned_driver_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      upsells: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          job_id: string;
          type: Database["public"]["Enums"]["upsell_type"];
          verified: boolean;
        };
        Insert: {
          amount: number;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          job_id: string;
          type: Database["public"]["Enums"]["upsell_type"];
          verified?: boolean;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          job_id?: string;
          type?: Database["public"]["Enums"]["upsell_type"];
          verified?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "upsells_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "upsells_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      wash_overdue_events: {
        Row: {
          created_at: string;
          driver_id: string | null;
          due_date: string;
          excused: boolean;
          excused_by: string | null;
          id: string;
          since: string;
          truck_id: string;
        };
        Insert: {
          created_at?: string;
          driver_id?: string | null;
          due_date: string;
          excused?: boolean;
          excused_by?: string | null;
          id?: string;
          since: string;
          truck_id: string;
        };
        Update: {
          created_at?: string;
          driver_id?: string | null;
          due_date?: string;
          excused?: boolean;
          excused_by?: string | null;
          id?: string;
          since?: string;
          truck_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wash_overdue_events_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wash_overdue_events_excused_by_fkey";
            columns: ["excused_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wash_overdue_events_truck_id_fkey";
            columns: ["truck_id"];
            isOneToOne: false;
            referencedRelation: "trucks";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_attribute_review: {
        Args: {
          p_change_reason: string;
          p_counts_for_driver: boolean;
          p_id: string;
          p_platform: Database["public"]["Enums"]["review_platform"];
          p_reason: string;
          p_rep_id: string;
          p_stars: number;
        };
        Returns: string;
      };
      admin_clear_sample_leads: { Args: never; Returns: number };
      admin_correct_damage: {
        Args: {
          p_attributed_driver_id?: string;
          p_attributed_to?: string;
          p_carrier_id?: string;
          p_claim_filed: boolean;
          p_damage_date: string;
          p_description: string;
          p_estimated_cost: number;
          p_id: string;
          p_item: string;
          p_keep_attribution?: boolean;
          p_reason: string;
          p_reported_by?: string;
          p_reported_on?: string;
          p_source: string;
        };
        Returns: string;
      };
      admin_correct_offload: {
        Args: {
          p_carrier_id: string;
          p_destination: string;
          p_forms: Json;
          p_id: string;
          p_note: string;
          p_reason: string;
          p_storage_address: string;
          p_storage_facility: string;
          p_storage_unit: string;
        };
        Returns: string;
      };
      admin_correct_pre_damage: {
        Args: {
          p_customer_name: string;
          p_description: string;
          p_id: string;
          p_item: string;
          p_location: string;
          p_notes: string;
          p_reason: string;
        };
        Returns: string;
      };
      admin_delete_cost_range: { Args: { p_id: string }; Returns: undefined };
      admin_override_lead_cost: {
        Args: { p_cost: number; p_lead: string };
        Returns: string;
      };
      admin_save_cost_range: {
        Args: {
          p_amount: number;
          p_end: string;
          p_id: string;
          p_mode: string;
          p_note: string;
          p_source: string;
          p_start: string;
        };
        Returns: string;
      };
      admin_seed_sample_leads: { Args: never; Returns: number };
      admin_set_deleted: {
        Args: {
          p_deleted: boolean;
          p_id: string;
          p_kind: string;
          p_reason?: string;
        };
        Returns: string;
      };
      admin_set_offload_deleted: {
        Args: { p_deleted: boolean; p_id: string; p_reason?: string };
        Returns: string;
      };
      admin_set_weekly_cost: {
        Args: { p_cost: number; p_source: string; p_week: string };
        Returns: number;
      };
      app_role: {
        Args: never;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      carrier_choices: {
        Args: never;
        Returns: {
          active: boolean;
          company_name: string;
          id: string;
        }[];
      };
      flag_overdue_washes: { Args: never; Returns: number };
      get_scoring: { Args: never; Returns: Json };
      is_admin: { Args: never; Returns: boolean };
      lead_cost_for: {
        Args: { p_date: string; p_source: string };
        Returns: number;
      };
      my_carrier_id: { Args: never; Returns: string };
      new_deleted_is_null: { Args: { p: Json }; Returns: boolean };
      owns_job: { Args: { p_job: string }; Returns: boolean };
      recalc_lead_costs: { Args: { p_source: string }; Returns: number };
      refresh_cost_range: { Args: { p_id: string }; Returns: undefined };
      seed_sample_leads_internal: { Args: never; Returns: number };
      truck_responsible_driver: { Args: { p_truck: string }; Returns: string };
    };
    Enums: {
      delivered_by: "drs" | "partner";
      lead_status: "open" | "booked";
      review_platform: "google" | "bbb" | "trustpilot" | "facebook" | "other";
      roadside_result: "clean" | "violations" | "out_of_service";
      ticket_status: "open" | "in_progress" | "fixed";
      truck_status: "safe" | "repair_soon" | "do_not_drive";
      upsell_type: "packing" | "storage" | "materials" | "other";
      user_role: "admin" | "driver" | "sales_rep" | "carrier";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      delivered_by: ["drs", "partner"],
      lead_status: ["open", "booked"],
      review_platform: ["google", "bbb", "trustpilot", "facebook", "other"],
      roadside_result: ["clean", "violations", "out_of_service"],
      ticket_status: ["open", "in_progress", "fixed"],
      truck_status: ["safe", "repair_soon", "do_not_drive"],
      upsell_type: ["packing", "storage", "materials", "other"],
      user_role: ["admin", "driver", "sales_rep", "carrier"],
    },
  },
} as const;
