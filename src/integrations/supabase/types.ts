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
      action_item: {
        Row: {
          action_plan_id: string
          actual_end_date: string | null
          actual_start_date: string | null
          assignee_external_name: string | null
          assignee_id: string | null
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          how: string | null
          how_much: number | null
          id: string
          planned_start_date: string | null
          priority: string
          progress: number
          sort_order: number
          status: string
          title: string
          updated_at: string
          what: string | null
          where_loc: string | null
          why: string | null
        }
        Insert: {
          action_plan_id: string
          actual_end_date?: string | null
          actual_start_date?: string | null
          assignee_external_name?: string | null
          assignee_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          how?: string | null
          how_much?: number | null
          id?: string
          planned_start_date?: string | null
          priority?: string
          progress?: number
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          what?: string | null
          where_loc?: string | null
          why?: string | null
        }
        Update: {
          action_plan_id?: string
          actual_end_date?: string | null
          actual_start_date?: string | null
          assignee_external_name?: string | null
          assignee_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          how?: string | null
          how_much?: number | null
          id?: string
          planned_start_date?: string | null
          priority?: string
          progress?: number
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          what?: string | null
          where_loc?: string | null
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_item_action_plan_id_fkey"
            columns: ["action_plan_id"]
            isOneToOne: false
            referencedRelation: "action_plan"
            referencedColumns: ["id"]
          },
        ]
      }
      action_plan: {
        Row: {
          actual_end_date: string | null
          actual_start_date: string | null
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          justification: string | null
          objective: string | null
          origin_id: string | null
          origin_type: string
          owner_id: string | null
          planned_end_date: string | null
          planned_start_date: string | null
          priority: string
          progress: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          justification?: string | null
          objective?: string | null
          origin_id?: string | null
          origin_type?: string
          owner_id?: string | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          priority?: string
          progress?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          justification?: string | null
          objective?: string | null
          origin_id?: string | null
          origin_type?: string
          owner_id?: string | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          priority?: string
          progress?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      action_plan_area: {
        Row: {
          action_plan_id: string
          area_id: string
          created_at: string
          id: string
          is_primary: boolean
        }
        Insert: {
          action_plan_id: string
          area_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
        }
        Update: {
          action_plan_id?: string
          area_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "action_plan_area_action_plan_id_fkey"
            columns: ["action_plan_id"]
            isOneToOne: false
            referencedRelation: "action_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plan_area_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "area"
            referencedColumns: ["id"]
          },
        ]
      }
      action_plan_member: {
        Row: {
          action_plan_id: string
          created_at: string
          id: string
          role_in_plan: string
          user_id: string
        }
        Insert: {
          action_plan_id: string
          created_at?: string
          id?: string
          role_in_plan?: string
          user_id: string
        }
        Update: {
          action_plan_id?: string
          created_at?: string
          id?: string
          role_in_plan?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plan_member_action_plan_id_fkey"
            columns: ["action_plan_id"]
            isOneToOne: false
            referencedRelation: "action_plan"
            referencedColumns: ["id"]
          },
        ]
      }
      area: {
        Row: {
          acronym: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          parent_area_id: string | null
          sort_order: number
          status: Database["public"]["Enums"]["area_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          acronym?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          parent_area_id?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["area_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          acronym?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          parent_area_id?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["area_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "area_parent_area_id_fkey"
            columns: ["parent_area_id"]
            isOneToOne: false
            referencedRelation: "area"
            referencedColumns: ["id"]
          },
        ]
      }
      area_manager: {
        Row: {
          area_id: string
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          include_child_areas: boolean
          manager_type: Database["public"]["Enums"]["manager_type"]
          start_date: string
          status: Database["public"]["Enums"]["area_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          area_id: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          include_child_areas?: boolean
          manager_type?: Database["public"]["Enums"]["manager_type"]
          start_date?: string
          status?: Database["public"]["Enums"]["area_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          area_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          include_child_areas?: boolean
          manager_type?: Database["public"]["Enums"]["manager_type"]
          start_date?: string
          status?: Database["public"]["Enums"]["area_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "area_manager_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "area"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: string | null
          entity: string | null
          entity_id: string | null
          id: string
          ip_address: string | null
          module: string
          new_value: string | null
          previous_value: string | null
          user_id: string | null
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          module: string
          new_value?: string | null
          previous_value?: string | null
          user_id?: string | null
          user_name?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          module?: string
          new_value?: string | null
          previous_value?: string | null
          user_id?: string | null
          user_name?: string
        }
        Relationships: []
      }
      change_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          entity_id: string
          entity_type: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          entity_id: string
          entity_type: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          entity_id?: string
          entity_type?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: []
      }
      document: {
        Row: {
          created_at: string
          created_by: string | null
          current_version_id: string | null
          description: string | null
          id: string
          portfolio_id: string | null
          program_id: string | null
          project_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          description?: string | null
          id?: string
          portfolio_id?: string | null
          program_id?: string | null
          project_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          description?: string | null
          id?: string
          portfolio_id?: string | null
          program_id?: string | null
          project_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "document_version"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "mv_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "document_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "document_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "program"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
        ]
      }
      document_acl: {
        Row: {
          created_at: string
          document_id: string
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          permission: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_acl_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document"
            referencedColumns: ["id"]
          },
        ]
      }
      document_approval: {
        Row: {
          approver_id: string
          comment: string | null
          created_at: string
          decided_at: string | null
          decision: string
          id: string
          step: number
          version_id: string
        }
        Insert: {
          approver_id: string
          comment?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: string
          id?: string
          step: number
          version_id: string
        }
        Update: {
          approver_id?: string
          comment?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: string
          id?: string
          step?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_approval_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "document_version"
            referencedColumns: ["id"]
          },
        ]
      }
      document_version: {
        Row: {
          document_id: string
          file_name: string | null
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
          version_no: number
        }
        Insert: {
          document_id: string
          file_name?: string | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
          version_no: number
        }
        Update: {
          document_id?: string
          file_name?: string | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_version_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document"
            referencedColumns: ["id"]
          },
        ]
      }
      fab_drawings: {
        Row: {
          conteudo: Json
          created_at: string
          id: string
          processado: boolean
          texto_extraido: string | null
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conteudo?: Json
          created_at?: string
          id?: string
          processado?: boolean
          texto_extraido?: string | null
          tipo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conteudo?: Json
          created_at?: string
          id?: string
          processado?: boolean
          texto_extraido?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ged_document: {
        Row: {
          atualizado_por: string | null
          created_at: string
          criado_por: string | null
          data_emissao: string | null
          data_validade: string | null
          descricao: string | null
          id: string
          instituicao_id: string | null
          numero_documento: string | null
          observacoes: string | null
          orgao_emissor: string | null
          origem_documento: Database["public"]["Enums"]["ged_document_origin"]
          parceiro_id: string | null
          produto_id: string | null
          status: Database["public"]["Enums"]["ged_document_status"]
          tags: string[]
          tipo_documento: Database["public"]["Enums"]["ged_document_type"]
          titulo: string
          updated_at: string
        }
        Insert: {
          atualizado_por?: string | null
          created_at?: string
          criado_por?: string | null
          data_emissao?: string | null
          data_validade?: string | null
          descricao?: string | null
          id?: string
          instituicao_id?: string | null
          numero_documento?: string | null
          observacoes?: string | null
          orgao_emissor?: string | null
          origem_documento: Database["public"]["Enums"]["ged_document_origin"]
          parceiro_id?: string | null
          produto_id?: string | null
          status?: Database["public"]["Enums"]["ged_document_status"]
          tags?: string[]
          tipo_documento: Database["public"]["Enums"]["ged_document_type"]
          titulo: string
          updated_at?: string
        }
        Update: {
          atualizado_por?: string | null
          created_at?: string
          criado_por?: string | null
          data_emissao?: string | null
          data_validade?: string | null
          descricao?: string | null
          id?: string
          instituicao_id?: string | null
          numero_documento?: string | null
          observacoes?: string | null
          orgao_emissor?: string | null
          origem_documento?: Database["public"]["Enums"]["ged_document_origin"]
          parceiro_id?: string | null
          produto_id?: string | null
          status?: Database["public"]["Enums"]["ged_document_status"]
          tags?: string[]
          tipo_documento?: Database["public"]["Enums"]["ged_document_type"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ged_document_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "ged_institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ged_document_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "ged_partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ged_document_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "ged_product"
            referencedColumns: ["id"]
          },
        ]
      }
      ged_document_acl: {
        Row: {
          created_at: string
          documento_id: string
          granted_by: string | null
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string
          documento_id: string
          granted_by?: string | null
          id?: string
          permission?: string
          user_id: string
        }
        Update: {
          created_at?: string
          documento_id?: string
          granted_by?: string | null
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ged_document_acl_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "ged_document"
            referencedColumns: ["id"]
          },
        ]
      }
      ged_document_index: {
        Row: {
          created_at: string
          documento_id: string
          embedding: Json | null
          entidades_identificadas: Json
          id: string
          indexado_em: string | null
          palavras_chave: string[]
          resumo_ia: string | null
          status_indexacao: Database["public"]["Enums"]["ged_index_status"]
          texto_indexado: string | null
          updated_at: string
          versao_documento_id: string | null
        }
        Insert: {
          created_at?: string
          documento_id: string
          embedding?: Json | null
          entidades_identificadas?: Json
          id?: string
          indexado_em?: string | null
          palavras_chave?: string[]
          resumo_ia?: string | null
          status_indexacao?: Database["public"]["Enums"]["ged_index_status"]
          texto_indexado?: string | null
          updated_at?: string
          versao_documento_id?: string | null
        }
        Update: {
          created_at?: string
          documento_id?: string
          embedding?: Json | null
          entidades_identificadas?: Json
          id?: string
          indexado_em?: string | null
          palavras_chave?: string[]
          resumo_ia?: string | null
          status_indexacao?: Database["public"]["Enums"]["ged_index_status"]
          texto_indexado?: string | null
          updated_at?: string
          versao_documento_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ged_document_index_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: true
            referencedRelation: "ged_document"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ged_document_index_versao_documento_id_fkey"
            columns: ["versao_documento_id"]
            isOneToOne: false
            referencedRelation: "ged_document_version"
            referencedColumns: ["id"]
          },
        ]
      }
      ged_document_version: {
        Row: {
          arquivo_url: string
          created_at: string
          documento_id: string
          enviado_por: string | null
          hash_arquivo: string | null
          id: string
          motivo_nova_versao: string | null
          nome_arquivo: string | null
          numero_versao: number
          tamanho_arquivo: number | null
          tipo_arquivo: string | null
          versao_atual: boolean
        }
        Insert: {
          arquivo_url: string
          created_at?: string
          documento_id: string
          enviado_por?: string | null
          hash_arquivo?: string | null
          id?: string
          motivo_nova_versao?: string | null
          nome_arquivo?: string | null
          numero_versao: number
          tamanho_arquivo?: number | null
          tipo_arquivo?: string | null
          versao_atual?: boolean
        }
        Update: {
          arquivo_url?: string
          created_at?: string
          documento_id?: string
          enviado_por?: string | null
          hash_arquivo?: string | null
          id?: string
          motivo_nova_versao?: string | null
          nome_arquivo?: string | null
          numero_versao?: number
          tamanho_arquivo?: number | null
          tipo_arquivo?: string | null
          versao_atual?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ged_document_version_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "ged_document"
            referencedColumns: ["id"]
          },
        ]
      }
      ged_institution: {
        Row: {
          created_at: string
          description: string | null
          fantasy_name: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          fantasy_name?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          fantasy_name?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ged_partner: {
        Row: {
          contact_email: string | null
          created_at: string
          document: string | null
          fantasy_name: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          document?: string | null
          fantasy_name?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          document?: string | null
          fantasy_name?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ged_product: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          document_id: string
          id: string
          user_id: string
          version_id: string
        }
        Insert: {
          accepted_at?: string
          document_id: string
          id?: string
          user_id: string
          version_id: string
        }
        Update: {
          accepted_at?: string
          document_id?: string
          id?: string
          user_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_acceptances_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_acceptances_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "legal_document_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_document_versions: {
        Row: {
          content: string
          document_id: string
          id: string
          published_at: string
          published_by: string
          requires_acceptance: boolean
          version: number
        }
        Insert: {
          content: string
          document_id: string
          id?: string
          published_at?: string
          published_by?: string
          requires_acceptance?: boolean
          version: number
        }
        Update: {
          content?: string
          document_id?: string
          id?: string
          published_at?: string
          published_by?: string
          requires_acceptance?: boolean
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
          created_at: string
          id: string
          is_active: boolean
          title: string
          type: Database["public"]["Enums"]["legal_doc_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          title: string
          type: Database["public"]["Enums"]["legal_doc_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          title?: string
          type?: Database["public"]["Enums"]["legal_doc_type"]
          updated_at?: string
        }
        Relationships: []
      }
      meeting: {
        Row: {
          agenda: string | null
          created_at: string
          created_by: string
          duration_minutes: number | null
          id: string
          location: string | null
          manager_id: string | null
          modality: string
          organizer_id: string | null
          portfolio_id: string | null
          program_id: string | null
          project_id: string | null
          scheduled_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          agenda?: string | null
          created_at?: string
          created_by?: string
          duration_minutes?: number | null
          id?: string
          location?: string | null
          manager_id?: string | null
          modality?: string
          organizer_id?: string | null
          portfolio_id?: string | null
          program_id?: string | null
          project_id?: string | null
          scheduled_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          agenda?: string | null
          created_at?: string
          created_by?: string
          duration_minutes?: number | null
          id?: string
          location?: string | null
          manager_id?: string | null
          modality?: string
          organizer_id?: string | null
          portfolio_id?: string | null
          program_id?: string | null
          project_id?: string | null
          scheduled_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "mv_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "meeting_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "meeting_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "program"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_action_item: {
        Row: {
          assignee_email_hint: string | null
          assignee_external_name: string | null
          assignee_id: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          meeting_id: string
          priority: string
          promoted_to_task_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_email_hint?: string | null
          assignee_external_name?: string | null
          assignee_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          meeting_id: string
          priority?: string
          promoted_to_task_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_email_hint?: string | null
          assignee_external_name?: string | null
          assignee_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          meeting_id?: string
          priority?: string
          promoted_to_task_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_action_item_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meeting"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_action_item_promoted_to_task_id_fkey"
            columns: ["promoted_to_task_id"]
            isOneToOne: false
            referencedRelation: "task"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_minute: {
        Row: {
          ai_model: string | null
          created_at: string
          formatted_content: string | null
          generated_at: string | null
          generated_by: string | null
          generation_mode: string
          id: string
          meeting_id: string
          raw_input: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ai_model?: string | null
          created_at?: string
          formatted_content?: string | null
          generated_at?: string | null
          generated_by?: string | null
          generation_mode?: string
          id?: string
          meeting_id: string
          raw_input?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ai_model?: string | null
          created_at?: string
          formatted_content?: string | null
          generated_at?: string | null
          generated_by?: string | null
          generation_mode?: string
          id?: string
          meeting_id?: string
          raw_input?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_minute_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meeting"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participant: {
        Row: {
          attended: boolean | null
          created_at: string
          id: string
          meeting_id: string
          role_in_meeting: string
          user_id: string
        }
        Insert: {
          attended?: boolean | null
          created_at?: string
          id?: string
          meeting_id: string
          role_in_meeting?: string
          user_id: string
        }
        Update: {
          attended?: boolean | null
          created_at?: string
          id?: string
          meeting_id?: string
          role_in_meeting?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participant_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meeting"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification: {
        Row: {
          acknowledgment_deadline: string | null
          archived_at: string | null
          canceled_at: string | null
          canceled_by: string | null
          cancellation_reason: string | null
          code: string | null
          created_at: string
          current_version: number
          id: string
          internal_notes: string | null
          message: string
          notification_type: Database["public"]["Enums"]["notification_type"]
          priority: Database["public"]["Enums"]["notification_priority"]
          publication_date: string
          reminder_enabled: boolean
          reminder_frequency:
            | Database["public"]["Enums"]["notification_reminder_frequency"]
            | null
          requires_acknowledgment: boolean
          scheduled_at: string | null
          sender_area_id: string | null
          sender_user_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          title: string
          updated_at: string
        }
        Insert: {
          acknowledgment_deadline?: string | null
          archived_at?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          cancellation_reason?: string | null
          code?: string | null
          created_at?: string
          current_version?: number
          id?: string
          internal_notes?: string | null
          message: string
          notification_type?: Database["public"]["Enums"]["notification_type"]
          priority?: Database["public"]["Enums"]["notification_priority"]
          publication_date?: string
          reminder_enabled?: boolean
          reminder_frequency?:
            | Database["public"]["Enums"]["notification_reminder_frequency"]
            | null
          requires_acknowledgment?: boolean
          scheduled_at?: string | null
          sender_area_id?: string | null
          sender_user_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title: string
          updated_at?: string
        }
        Update: {
          acknowledgment_deadline?: string | null
          archived_at?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          cancellation_reason?: string | null
          code?: string | null
          created_at?: string
          current_version?: number
          id?: string
          internal_notes?: string | null
          message?: string
          notification_type?: Database["public"]["Enums"]["notification_type"]
          priority?: Database["public"]["Enums"]["notification_priority"]
          publication_date?: string
          reminder_enabled?: boolean
          reminder_frequency?:
            | Database["public"]["Enums"]["notification_reminder_frequency"]
            | null
          requires_acknowledgment?: boolean
          scheduled_at?: string | null
          sender_area_id?: string | null
          sender_user_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_sender_area_id_fkey"
            columns: ["sender_area_id"]
            isOneToOne: false
            referencedRelation: "area"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_attachment: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          notification_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          notification_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          notification_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_attachment_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notification"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_audit: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          notification_id: string | null
          previous_data: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          notification_id?: string | null
          previous_data?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          notification_id?: string | null
          previous_data?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_audit_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notification"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_group: {
        Row: {
          area_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          group_type: Database["public"]["Enums"]["notification_group_type"]
          id: string
          leader_user_id: string | null
          name: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          area_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          group_type?: Database["public"]["Enums"]["notification_group_type"]
          id?: string
          leader_user_id?: string | null
          name: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          area_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          group_type?: Database["public"]["Enums"]["notification_group_type"]
          id?: string
          leader_user_id?: string | null
          name?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_group_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "area"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_group_member: {
        Row: {
          added_at: string
          added_by: string | null
          group_id: string
          id: string
          removed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          group_id: string
          id?: string
          removed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          group_id?: string
          id?: string
          removed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_group_member_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "notification_group"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_recipient: {
        Row: {
          acknowledged_after_deadline: boolean | null
          acknowledged_at: string | null
          acknowledged_ip: string | null
          acknowledged_user_agent: string | null
          acknowledged_version: number | null
          acknowledgment_status: Database["public"]["Enums"]["notification_ack_status"]
          created_at: string
          delivered_at: string | null
          delivery_status: Database["public"]["Enums"]["notification_delivery_status"]
          first_viewed_at: string | null
          id: string
          last_reminder_at: string | null
          last_viewed_at: string | null
          notification_id: string
          reminder_count: number
          source_id: string | null
          source_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          acknowledged_after_deadline?: boolean | null
          acknowledged_at?: string | null
          acknowledged_ip?: string | null
          acknowledged_user_agent?: string | null
          acknowledged_version?: number | null
          acknowledgment_status?: Database["public"]["Enums"]["notification_ack_status"]
          created_at?: string
          delivered_at?: string | null
          delivery_status?: Database["public"]["Enums"]["notification_delivery_status"]
          first_viewed_at?: string | null
          id?: string
          last_reminder_at?: string | null
          last_viewed_at?: string | null
          notification_id: string
          reminder_count?: number
          source_id?: string | null
          source_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          acknowledged_after_deadline?: boolean | null
          acknowledged_at?: string | null
          acknowledged_ip?: string | null
          acknowledged_user_agent?: string | null
          acknowledged_version?: number | null
          acknowledgment_status?: Database["public"]["Enums"]["notification_ack_status"]
          created_at?: string
          delivered_at?: string | null
          delivery_status?: Database["public"]["Enums"]["notification_delivery_status"]
          first_viewed_at?: string | null
          id?: string
          last_reminder_at?: string | null
          last_viewed_at?: string | null
          notification_id?: string
          reminder_count?: number
          source_id?: string | null
          source_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_recipient_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notification"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reminder_log: {
        Row: {
          channel: string
          created_at: string
          id: string
          notification_id: string
          recipient_count: number
          reminder_type: string
          sent_by: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          notification_id: string
          recipient_count?: number
          reminder_type?: string
          sent_by?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          notification_id?: string
          recipient_count?: number
          reminder_type?: string
          sent_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_reminder_log_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notification"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_version: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          created_at: string
          id: string
          message: string
          notification_id: string
          requires_new_acknowledgment: boolean | null
          title: string
          version_number: number
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          message: string
          notification_id: string
          requires_new_acknowledgment?: boolean | null
          title: string
          version_number: number
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          message?: string
          notification_id?: string
          requires_new_acknowledgment?: boolean | null
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "notification_version_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notification"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          attempts: number
          best_score: number | null
          best_total: number | null
          completed_at: string | null
          current_section: string | null
          sections_viewed: string[]
          started_at: string
          time_spent_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          best_score?: number | null
          best_total?: number | null
          completed_at?: string | null
          current_section?: string | null
          sections_viewed?: string[]
          started_at?: string
          time_spent_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          best_score?: number | null
          best_total?: number | null
          completed_at?: string | null
          current_section?: string | null
          sections_viewed?: string[]
          started_at?: string
          time_spent_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_quiz_answer: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean
          question_key: string
          selected_index: number
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          is_correct: boolean
          question_key: string
          selected_index: number
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_key?: string
          selected_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_quiz_answer_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "onboarding_quiz_attempt"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_quiz_attempt: {
        Row: {
          duration_seconds: number | null
          id: string
          passed: boolean
          score: number
          started_at: string
          submitted_at: string | null
          total: number
          user_id: string
        }
        Insert: {
          duration_seconds?: number | null
          id?: string
          passed?: boolean
          score?: number
          started_at?: string
          submitted_at?: string | null
          total?: number
          user_id: string
        }
        Update: {
          duration_seconds?: number | null
          id?: string
          passed?: boolean
          score?: number
          started_at?: string
          submitted_at?: string | null
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      onboarding_settings: {
        Row: {
          enabled: boolean
          exempt_role_names: string[]
          id: boolean
          passing_score: number
          total_questions: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          exempt_role_names?: string[]
          id?: boolean
          passing_score?: number
          total_questions?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          exempt_role_names?: string[]
          id?: boolean
          passing_score?: number
          total_questions?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      password_history: {
        Row: {
          created_at: string
          id: string
          password_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          password_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          password_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      pdca_items: {
        Row: {
          created_at: string
          due: string | null
          id: string
          kind: string
          ordem: number
          origin: string
          owner: string
          status: string
          text: string
          updated_at: string
          week_id: string
        }
        Insert: {
          created_at?: string
          due?: string | null
          id?: string
          kind?: string
          ordem?: number
          origin?: string
          owner?: string
          status?: string
          text?: string
          updated_at?: string
          week_id: string
        }
        Update: {
          created_at?: string
          due?: string | null
          id?: string
          kind?: string
          ordem?: number
          origin?: string
          owner?: string
          status?: string
          text?: string
          updated_at?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdca_items_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "pdca_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      pdca_weeks: {
        Row: {
          archived_at: string | null
          blockers: string
          created_at: string
          done: number | null
          goal: number
          id: string
          pct: number | null
          status: string
          total: number | null
          updated_at: string
          week_date: string
          week_num: number
        }
        Insert: {
          archived_at?: string | null
          blockers?: string
          created_at?: string
          done?: number | null
          goal?: number
          id?: string
          pct?: number | null
          status?: string
          total?: number | null
          updated_at?: string
          week_date?: string
          week_num: number
        }
        Update: {
          archived_at?: string | null
          blockers?: string
          created_at?: string
          done?: number | null
          goal?: number
          id?: string
          pct?: number | null
          status?: string
          total?: number | null
          updated_at?: string
          week_date?: string
          week_num?: number
        }
        Relationships: []
      }
      permissions: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          module: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          module: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          module?: string
        }
        Relationships: []
      }
      phase: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          name: string
          ordering: number
          project_id: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          ordering?: number
          project_id: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          ordering?: number
          project_id?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phase_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio: {
        Row: {
          created_at: string
          id: string
          name: string
          objective: string | null
          owner_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          objective?: string | null
          owner_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          objective?: string | null
          owner_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      portfolio_area: {
        Row: {
          area_id: string
          created_at: string
          id: string
          is_primary: boolean
          portfolio_id: string
        }
        Insert: {
          area_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          portfolio_id: string
        }
        Update: {
          area_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          portfolio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_area_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "area"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_area_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "mv_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "portfolio_area_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_area_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      privacy_settings: {
        Row: {
          data_categories: string[] | null
          dpo_email: string | null
          dpo_name: string | null
          id: string
          retention_days: number
          show_cookie_banner: boolean
          updated_at: string
        }
        Insert: {
          data_categories?: string[] | null
          dpo_email?: string | null
          dpo_name?: string | null
          id?: string
          retention_days?: number
          show_cookie_banner?: boolean
          updated_at?: string
        }
        Update: {
          data_categories?: string[] | null
          dpo_email?: string | null
          dpo_name?: string | null
          id?: string
          retention_days?: number
          show_cookie_banner?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          direct_manager_id: string | null
          email: string | null
          id: string
          last_access: string | null
          locked_until: string | null
          login_attempts: number
          must_change_password: boolean
          name: string
          notes: string | null
          position: string | null
          primary_area_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          direct_manager_id?: string | null
          email?: string | null
          id?: string
          last_access?: string | null
          locked_until?: string | null
          login_attempts?: number
          must_change_password?: boolean
          name: string
          notes?: string | null
          position?: string | null
          primary_area_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          direct_manager_id?: string | null
          email?: string | null
          id?: string
          last_access?: string | null
          locked_until?: string | null
          login_attempts?: number
          must_change_password?: boolean
          name?: string
          notes?: string | null
          position?: string | null
          primary_area_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_primary_area_id_fkey"
            columns: ["primary_area_id"]
            isOneToOne: false
            referencedRelation: "area"
            referencedColumns: ["id"]
          },
        ]
      }
      program: {
        Row: {
          benefits: string | null
          created_at: string
          end_date: string | null
          id: string
          name: string
          owner_id: string | null
          portfolio_id: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          benefits?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          owner_id?: string | null
          portfolio_id: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          benefits?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          portfolio_id?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "mv_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "program_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      project: {
        Row: {
          baseline_end_date: string | null
          budget_planned: number | null
          budget_spent: number
          code: string | null
          created_at: string
          description: string | null
          end_date: string | null
          health: string
          id: string
          manager_id: string | null
          name: string
          portfolio_id: string | null
          program_id: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          baseline_end_date?: string | null
          budget_planned?: number | null
          budget_spent?: number
          code?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          health?: string
          id?: string
          manager_id?: string | null
          name: string
          portfolio_id?: string | null
          program_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          baseline_end_date?: string | null
          budget_planned?: number | null
          budget_spent?: number
          code?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          health?: string
          id?: string
          manager_id?: string | null
          name?: string
          portfolio_id?: string | null
          program_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "mv_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "project_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "project_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "program"
            referencedColumns: ["id"]
          },
        ]
      }
      project_deliverable: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          order_index: number
          owner_id: string | null
          progress: number
          project_id: string
          start_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          order_index?: number
          owner_id?: string | null
          progress?: number
          project_id: string
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          order_index?: number
          owner_id?: string | null
          progress?: number
          project_id?: string
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_deliverable_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
        ]
      }
      project_member: {
        Row: {
          created_at: string
          project_id: string
          role_in_project: string
          user_id: string
        }
        Insert: {
          created_at?: string
          project_id: string
          role_in_project?: string
          user_id: string
        }
        Update: {
          created_at?: string
          project_id?: string
          role_in_project?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_member_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
        ]
      }
      risk: {
        Row: {
          created_at: string
          description: string
          exposure: number | null
          id: string
          impact: number | null
          probability: number | null
          project_id: string
          response: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          exposure?: number | null
          id?: string
          impact?: number | null
          probability?: number | null
          project_id: string
          response?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          exposure?: number | null
          id?: string
          impact?: number | null
          probability?: number | null
          project_id?: string
          response?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_item: {
        Row: {
          bucket: string
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          ordering: number
          portfolio_id: string | null
          program_id: string | null
          project_id: string | null
          start_date: string | null
          swimlane: string | null
          title: string
          updated_at: string
        }
        Insert: {
          bucket?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          ordering?: number
          portfolio_id?: string | null
          program_id?: string | null
          project_id?: string | null
          start_date?: string | null
          swimlane?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          bucket?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          ordering?: number
          portfolio_id?: string | null
          program_id?: string | null
          project_id?: string | null
          start_date?: string | null
          swimlane?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_item_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "mv_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "roadmap_item_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_item_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "roadmap_item_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "program"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_item_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_settings: {
        Row: {
          allow_multiple_sessions: boolean
          id: string
          lockout_duration_minutes: number
          max_login_attempts: number
          mfa_enabled: boolean
          min_password_length: number
          password_expiration_days: number
          password_history_count: number
          require_lowercase: boolean
          require_numbers: boolean
          require_password_change_first_access: boolean
          require_special_chars: boolean
          require_uppercase: boolean
          session_timeout_minutes: number
          updated_at: string
        }
        Insert: {
          allow_multiple_sessions?: boolean
          id?: string
          lockout_duration_minutes?: number
          max_login_attempts?: number
          mfa_enabled?: boolean
          min_password_length?: number
          password_expiration_days?: number
          password_history_count?: number
          require_lowercase?: boolean
          require_numbers?: boolean
          require_password_change_first_access?: boolean
          require_special_chars?: boolean
          require_uppercase?: boolean
          session_timeout_minutes?: number
          updated_at?: string
        }
        Update: {
          allow_multiple_sessions?: boolean
          id?: string
          lockout_duration_minutes?: number
          max_login_attempts?: number
          mfa_enabled?: boolean
          min_password_length?: number
          password_expiration_days?: number
          password_history_count?: number
          require_lowercase?: boolean
          require_numbers?: boolean
          require_password_change_first_access?: boolean
          require_special_chars?: boolean
          require_uppercase?: boolean
          session_timeout_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          app_description: string | null
          app_name: string
          app_short_name: string
          background_color: string | null
          contact_email: string | null
          environment: Database["public"]["Enums"]["environment_type"]
          favicon_url: string | null
          footer_text: string | null
          id: string
          language: string | null
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          updated_at: string
          version: string
        }
        Insert: {
          app_description?: string | null
          app_name?: string
          app_short_name?: string
          background_color?: string | null
          contact_email?: string | null
          environment?: Database["public"]["Enums"]["environment_type"]
          favicon_url?: string | null
          footer_text?: string | null
          id?: string
          language?: string | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
          version?: string
        }
        Update: {
          app_description?: string | null
          app_name?: string
          app_short_name?: string
          background_color?: string | null
          contact_email?: string | null
          environment?: Database["public"]["Enums"]["environment_type"]
          favicon_url?: string | null
          footer_text?: string | null
          id?: string
          language?: string | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      tarefas: {
        Row: {
          anotacoes: string | null
          assigned_at: string | null
          concluida_em: string | null
          created_at: string
          created_by: string | null
          data: string
          descricao: string | null
          duracao_min: number | null
          first_viewed_at: string | null
          hora: string | null
          id: string
          last_viewed_at: string | null
          origem: string
          origem_id: string | null
          prioridade: string
          status: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          anotacoes?: string | null
          assigned_at?: string | null
          concluida_em?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          descricao?: string | null
          duracao_min?: number | null
          first_viewed_at?: string | null
          hora?: string | null
          id?: string
          last_viewed_at?: string | null
          origem?: string
          origem_id?: string | null
          prioridade?: string
          status?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          anotacoes?: string | null
          assigned_at?: string | null
          concluida_em?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string | null
          duracao_min?: number | null
          first_viewed_at?: string | null
          hora?: string | null
          id?: string
          last_viewed_at?: string | null
          origem?: string
          origem_id?: string | null
          prioridade?: string
          status?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task: {
        Row: {
          assignee_external_name: string | null
          assignee_id: string | null
          baseline_end_date: string | null
          baseline_start_date: string | null
          created_at: string
          deliverable_id: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          observations: string | null
          order_index: number
          parent_task_id: string | null
          phase_id: string | null
          priority: string
          progress: number
          project_id: string
          start_date: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          assignee_external_name?: string | null
          assignee_id?: string | null
          baseline_end_date?: string | null
          baseline_start_date?: string | null
          created_at?: string
          deliverable_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          observations?: string | null
          order_index?: number
          parent_task_id?: string | null
          phase_id?: string | null
          priority?: string
          progress?: number
          project_id: string
          start_date?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          assignee_external_name?: string | null
          assignee_id?: string | null
          baseline_end_date?: string | null
          baseline_start_date?: string | null
          created_at?: string
          deliverable_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          observations?: string | null
          order_index?: number
          parent_task_id?: string | null
          phase_id?: string | null
          priority?: string
          progress?: number
          project_id?: string
          start_date?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "project_deliverable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "task"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phase"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachment: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          task_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          task_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          task_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachment_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependency: {
        Row: {
          created_at: string
          id: string
          lag_days: number
          predecessor_id: string
          project_id: string
          successor_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          lag_days?: number
          predecessor_id: string
          project_id: string
          successor_id: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          lag_days?: number
          predecessor_id?: string
          project_id?: string
          successor_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependency_predecessor_id_fkey"
            columns: ["predecessor_id"]
            isOneToOne: false
            referencedRelation: "task"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependency_successor_id_fkey"
            columns: ["successor_id"]
            isOneToOne: false
            referencedRelation: "task"
            referencedColumns: ["id"]
          },
        ]
      }
      user_area_membership: {
        Row: {
          area_id: string
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          membership_type: Database["public"]["Enums"]["membership_type"]
          purpose: string | null
          start_date: string
          status: Database["public"]["Enums"]["area_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          area_id: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          membership_type?: Database["public"]["Enums"]["membership_type"]
          purpose?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["area_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          area_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          membership_type?: Database["public"]["Enums"]["membership_type"]
          purpose?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["area_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_area_membership_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "area"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      workflow: {
        Row: {
          area_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "area"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_demand_attachment: {
        Row: {
          created_at: string
          demand_id: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          demand_id: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string
        }
        Update: {
          created_at?: string
          demand_id?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_demand_attachment_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "workflow_demands"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_demand_history: {
        Row: {
          action: string
          actor_id: string | null
          approver_id: string | null
          comment: string | null
          created_at: string
          demand_id: string
          from_user_id: string | null
          id: string
          step_id: string | null
          to_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          approver_id?: string | null
          comment?: string | null
          created_at?: string
          demand_id: string
          from_user_id?: string | null
          id?: string
          step_id?: string | null
          to_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          approver_id?: string | null
          comment?: string | null
          created_at?: string
          demand_id?: string
          from_user_id?: string | null
          id?: string
          step_id?: string | null
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_demand_history_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "workflow_demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_demand_history_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_demands: {
        Row: {
          code: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          current_approver_id: string | null
          current_responsible_id: string | null
          current_step_id: string | null
          description: string | null
          due_at: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
          workflow_id: string
        }
        Insert: {
          code?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          current_approver_id?: string | null
          current_responsible_id?: string | null
          current_step_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
          workflow_id: string
        }
        Update: {
          code?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          current_approver_id?: string | null
          current_responsible_id?: string | null
          current_step_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_demands_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_demands_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          approver_area_id: string | null
          approver_type: string | null
          approver_user_id: string | null
          created_at: string
          default_responsible_area_id: string | null
          default_responsible_type: string
          default_responsible_user_id: string | null
          description: string | null
          id: string
          name: string
          order_index: number
          requires_approval: boolean
          sla_hours: number
          updated_at: string
          workflow_id: string
        }
        Insert: {
          approver_area_id?: string | null
          approver_type?: string | null
          approver_user_id?: string | null
          created_at?: string
          default_responsible_area_id?: string | null
          default_responsible_type?: string
          default_responsible_user_id?: string | null
          description?: string | null
          id?: string
          name: string
          order_index: number
          requires_approval?: boolean
          sla_hours?: number
          updated_at?: string
          workflow_id: string
        }
        Update: {
          approver_area_id?: string | null
          approver_type?: string | null
          approver_user_id?: string | null
          created_at?: string
          default_responsible_area_id?: string | null
          default_responsible_type?: string
          default_responsible_user_id?: string | null
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          requires_approval?: boolean
          sla_hours?: number
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_approver_area_id_fkey"
            columns: ["approver_area_id"]
            isOneToOne: false
            referencedRelation: "area"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_steps_default_responsible_area_id_fkey"
            columns: ["default_responsible_area_id"]
            isOneToOne: false
            referencedRelation: "area"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      mv_portfolio_health: {
        Row: {
          avg_progress: number | null
          budget_planned: number | null
          budget_spent: number | null
          name: string | null
          portfolio_id: string | null
          projects_green: number | null
          projects_red: number | null
          projects_total: number | null
          projects_yellow: number | null
        }
        Relationships: []
      }
      v_portfolio_health: {
        Row: {
          avg_progress: number | null
          budget_planned: number | null
          budget_spent: number | null
          name: string | null
          portfolio_id: string | null
          projects_green: number | null
          projects_red: number | null
          projects_total: number | null
          projects_yellow: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _workflow_advance: { Args: { _demand_id: string }; Returns: undefined }
      action_plan_recalc_progress: {
        Args: { _plan_id: string }
        Returns: undefined
      }
      area_descendants: {
        Args: { _area_id: string }
        Returns: {
          id: string
        }[]
      }
      can_assign_tarefa: {
        Args: { _granter: string; _recipient: string }
        Returns: boolean
      }
      can_delete_action_plan: {
        Args: { _plan_id: string; _user_id: string }
        Returns: boolean
      }
      can_edit_action_plan: {
        Args: { _plan_id: string; _user_id: string }
        Returns: boolean
      }
      can_edit_portfolio: {
        Args: { _portfolio_id: string; _user_id: string }
        Returns: boolean
      }
      can_edit_program: {
        Args: { _program_id: string; _user_id: string }
        Returns: boolean
      }
      can_edit_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_meeting: {
        Args: { _meeting_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_notification: {
        Args: { _notification_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_task_attachment: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_workflow: {
        Args: { _user_id: string; _workflow_id: string }
        Returns: boolean
      }
      can_read_action_plan: {
        Args: { _plan_id: string; _user_id: string }
        Returns: boolean
      }
      can_read_demand: {
        Args: { _demand_id: string; _user_id: string }
        Returns: boolean
      }
      can_read_document: {
        Args: { _doc_id: string; _user_id: string }
        Returns: boolean
      }
      can_read_meeting: {
        Args: { _meeting_id: string; _user_id: string }
        Returns: boolean
      }
      can_read_notification: {
        Args: { _notification_id: string; _user_id: string }
        Returns: boolean
      }
      can_read_portfolio: {
        Args: { _portfolio_id: string; _user_id: string }
        Returns: boolean
      }
      can_read_program: {
        Args: { _program_id: string; _user_id: string }
        Returns: boolean
      }
      can_read_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_read_workflow: {
        Args: { _user_id: string; _workflow_id: string }
        Returns: boolean
      }
      can_view_workflow_demand: {
        Args: { _demand_id: string; _uid: string }
        Returns: boolean
      }
      can_write_document: {
        Args: { _doc_id: string; _user_id: string }
        Returns: boolean
      }
      cleanup_area_manager_for_user: {
        Args: { _user_id: string }
        Returns: undefined
      }
      cleanup_user_memberships: {
        Args: { _user_id: string }
        Returns: undefined
      }
      current_user_roles: { Args: never; Returns: string[] }
      first_name_key: { Args: { _full: string }; Returns: string }
      ged_can_edit_doc: {
        Args: { _doc_id: string; _user_id: string }
        Returns: boolean
      }
      ged_can_manage: { Args: { _uid: string }; Returns: boolean }
      ged_can_view: { Args: { _uid: string }; Returns: boolean }
      ged_can_view_doc: {
        Args: { _doc_id: string; _user_id: string }
        Returns: boolean
      }
      ged_has_shared_access: {
        Args: { _doc_id: string; _perms?: string[]; _user_id: string }
        Returns: boolean
      }
      ged_is_doc_owner: {
        Args: { _doc_id: string; _user_id: string }
        Returns: boolean
      }
      get_managed_action_items: {
        Args: { _manager_id: string }
        Returns: {
          assignee_email: string
          assignee_id: string
          assignee_name: string
          description: string
          due_date: string
          id: string
          meeting_id: string
          meeting_title: string
          priority: string
          status: string
          title: string
          updated_at: string
        }[]
      }
      get_public_security_settings: { Args: never; Returns: Json }
      get_user_permissions: {
        Args: { _user_id: string }
        Returns: {
          action: string
          module: string
        }[]
      }
      has_document_acl: {
        Args: { _doc_id: string; _perms: string[]; _user_id: string }
        Returns: boolean
      }
      has_module_perm: {
        Args: { _actions: string[]; _module: string; _user_id: string }
        Returns: boolean
      }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_action_plan_member: {
        Args: { _plan_id: string; _roles?: string[]; _user_id: string }
        Returns: boolean
      }
      is_active_user: { Args: { _user_id: string }; Returns: boolean }
      is_admin_or_pmo: { Args: { _uid: string }; Returns: boolean }
      is_document_creator: {
        Args: { _doc_id: string; _user_id: string }
        Returns: boolean
      }
      is_global_reader: { Args: { _uid: string }; Returns: boolean }
      is_leader: { Args: { _user_id: string }; Returns: boolean }
      is_portfolio_owner: {
        Args: { _portfolio_id: string; _user_id: string }
        Returns: boolean
      }
      is_reader: { Args: { _uid: string }; Returns: boolean }
      link_oauth_profile: {
        Args: { _email: string; _new_user_id: string }
        Returns: Json
      }
      manages_action_plan_area: {
        Args: { _plan_id: string; _user_id: string }
        Returns: boolean
      }
      notification_user_is_recipient: {
        Args: { _notification_id: string; _user_id: string }
        Returns: boolean
      }
      notification_user_is_sender: {
        Args: { _notification_id: string; _user_id: string }
        Returns: boolean
      }
      onboarding_required: { Args: { _user_id: string }; Returns: boolean }
      project_areas: {
        Args: { _project_id: string }
        Returns: {
          area_id: string
        }[]
      }
      user_belongs_to_area: {
        Args: { _area_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_access_area: {
        Args: { _area_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_join_action_plan: {
        Args: { _plan_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_join_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_manage_area: {
        Args: { _area_id: string; _user_id: string }
        Returns: boolean
      }
      user_leadership_user_ids: {
        Args: { _leader_id: string }
        Returns: {
          user_id: string
        }[]
      }
      user_managed_areas: {
        Args: { _user_id: string }
        Returns: {
          area_id: string
        }[]
      }
      user_manages_area: {
        Args: { _area_id: string; _user_id: string }
        Returns: boolean
      }
      user_visible_areas: {
        Args: { _user_id: string }
        Returns: {
          area_id: string
        }[]
      }
      users_visible_to: {
        Args: { _user_id: string }
        Returns: {
          user_id: string
        }[]
      }
      workflow_approve: {
        Args: { _comment?: string; _demand_id: string }
        Returns: undefined
      }
      workflow_complete_step: {
        Args: { _comment?: string; _demand_id: string }
        Returns: undefined
      }
      workflow_reject: {
        Args: { _comment: string; _demand_id: string }
        Returns: undefined
      }
      workflow_resolve_approver: {
        Args: { _demand_id: string; _step_id: string }
        Returns: string
      }
      workflow_resolve_responsible: {
        Args: { _demand_id: string; _step_id: string }
        Returns: string
      }
      workflow_resubmit: { Args: { _demand_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      area_status: "active" | "inactive"
      environment_type: "development" | "staging" | "production"
      ged_document_origin: "Parceiro" | "Própria instituição"
      ged_document_status: "Vigente" | "Vencido" | "Substituído" | "Inativo"
      ged_document_type:
        | "Certidão"
        | "Atestado de capacidade técnica"
        | "Laudo"
        | "INMETRO"
        | "Outro"
      ged_index_status: "Pendente" | "Indexado" | "Erro" | "Não aplicável"
      legal_doc_type: "privacy" | "terms" | "cookies"
      manager_type: "principal" | "substitute" | "support"
      membership_type: "primary" | "additional"
      notification_ack_status:
        | "nao_lida"
        | "visualizada"
        | "ciencia_pendente"
        | "ciencia_confirmada"
        | "ciencia_vencida"
      notification_delivery_status: "pendente" | "entregue" | "nao_entregue"
      notification_group_type:
        | "permanente"
        | "temporario"
        | "area"
        | "projeto"
        | "operacao"
      notification_priority: "baixa" | "normal" | "alta" | "urgente"
      notification_reminder_frequency:
        | "unico"
        | "diario"
        | "dois_dias"
        | "semanal"
      notification_status:
        | "rascunho"
        | "agendada"
        | "enviada"
        | "cancelada"
        | "arquivada"
      notification_type:
        | "comunicado"
        | "orientacao"
        | "procedimento"
        | "alerta"
        | "convocacao"
        | "atualizacao"
        | "informacao_administrativa"
        | "outro"
      user_status: "active" | "inactive" | "blocked"
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
      app_role: ["admin", "moderator", "user"],
      area_status: ["active", "inactive"],
      environment_type: ["development", "staging", "production"],
      ged_document_origin: ["Parceiro", "Própria instituição"],
      ged_document_status: ["Vigente", "Vencido", "Substituído", "Inativo"],
      ged_document_type: [
        "Certidão",
        "Atestado de capacidade técnica",
        "Laudo",
        "INMETRO",
        "Outro",
      ],
      ged_index_status: ["Pendente", "Indexado", "Erro", "Não aplicável"],
      legal_doc_type: ["privacy", "terms", "cookies"],
      manager_type: ["principal", "substitute", "support"],
      membership_type: ["primary", "additional"],
      notification_ack_status: [
        "nao_lida",
        "visualizada",
        "ciencia_pendente",
        "ciencia_confirmada",
        "ciencia_vencida",
      ],
      notification_delivery_status: ["pendente", "entregue", "nao_entregue"],
      notification_group_type: [
        "permanente",
        "temporario",
        "area",
        "projeto",
        "operacao",
      ],
      notification_priority: ["baixa", "normal", "alta", "urgente"],
      notification_reminder_frequency: [
        "unico",
        "diario",
        "dois_dias",
        "semanal",
      ],
      notification_status: [
        "rascunho",
        "agendada",
        "enviada",
        "cancelada",
        "arquivada",
      ],
      notification_type: [
        "comunicado",
        "orientacao",
        "procedimento",
        "alerta",
        "convocacao",
        "atualizacao",
        "informacao_administrativa",
        "outro",
      ],
      user_status: ["active", "inactive", "blocked"],
    },
  },
} as const
