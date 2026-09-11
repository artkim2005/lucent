export type SentimentLabel = "positive" | "neutral" | "negative";
export type BiasLabel = "left" | "center" | "right" | "mixed" | "unclear";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Database {
  public: {
    Tables: {
      sources: {
        Row: {
          id: string;
          name: string;
          listing_url: string;
          parser_strategy: string | null;
          logo_url: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          listing_url: string;
          parser_strategy?: string | null;
          logo_url?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sources"]["Insert"]>;
        Relationships: [];
      };
      articles: {
        Row: {
          id: string;
          source_id: string;
          original_url: string;
          canonical_url: string | null;
          title: string;
          image_url: string;
          published_at: string;
          raw_text: string;
          scraped_at: string;
          analyzed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_id: string;
          original_url: string;
          canonical_url?: string | null;
          title: string;
          image_url: string;
          published_at: string;
          raw_text: string;
          scraped_at?: string;
          analyzed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["articles"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "articles_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      article_analyses: {
        Row: {
          id: string;
          article_id: string;
          summary: string;
          sentiment_score: number;
          sentiment_label: SentimentLabel;
          bias_score: number;
          bias_label: BiasLabel;
          left_percentage: number;
          center_percentage: number;
          right_percentage: number;
          confidence: number;
          framing_notes: string | null;
          loaded_terms: string[];
          disclaimer: string;
          model: string;
          // pgvector column (section 20). PostgREST returns the pgvector
          // text representation (e.g. "[0.01,-0.02,...]"), not a JSON array.
          embedding: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          article_id: string;
          summary: string;
          sentiment_score: number;
          sentiment_label: SentimentLabel;
          bias_score: number;
          bias_label: BiasLabel;
          left_percentage: number;
          center_percentage: number;
          right_percentage: number;
          confidence: number;
          framing_notes?: string | null;
          loaded_terms?: string[];
          disclaimer: string;
          model: string;
          // Written as a plain number array (matches `embed()`'s return
          // value); Postgres/PostgREST casts it to `vector` on the way in.
          embedding?: number[] | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["article_analyses"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "article_analyses_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: true;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
        ];
      };
      logs: {
        Row: {
          id: string;
          level: LogLevel;
          source: string;
          message: string;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          level: LogLevel;
          source: string;
          message: string;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["logs"]["Insert"]>;
        Relationships: [];
      };
      oxylabs_schedules: {
        Row: {
          id: string;
          source_id: string;
          oxylabs_schedule_id: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source_id: string;
          oxylabs_schedule_id: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["oxylabs_schedules"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "oxylabs_schedules_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      oxylabs_schedule_runs: {
        Row: {
          id: string;
          schedule_id: string;
          oxylabs_run_id: string;
          result_status: string | null;
          processed: boolean;
          processed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          schedule_id: string;
          oxylabs_run_id: string;
          result_status?: string | null;
          processed?: boolean;
          processed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["oxylabs_schedule_runs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "oxylabs_schedule_runs_schedule_id_fkey";
            columns: ["schedule_id"];
            isOneToOne: false;
            referencedRelation: "oxylabs_schedules";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_related_articles: {
        Args: {
          query_embedding: string;
          exclude_article_id: string;
          match_count?: number;
        };
        Returns: Array<{
          id: string;
          title: string;
          image_url: string;
          published_at: string;
          source_name: string;
          sentiment_label: SentimentLabel;
          bias_label: BiasLabel;
          left_percentage: number;
          center_percentage: number;
          right_percentage: number;
          confidence: number;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type SourceRow = Database["public"]["Tables"]["sources"]["Row"];
export type ArticleRow = Database["public"]["Tables"]["articles"]["Row"];
export type ArticleAnalysisRow = Database["public"]["Tables"]["article_analyses"]["Row"];
export type LogRow = Database["public"]["Tables"]["logs"]["Row"];
export type OxylabsScheduleRow = Database["public"]["Tables"]["oxylabs_schedules"]["Row"];
export type OxylabsScheduleRunRow =
  Database["public"]["Tables"]["oxylabs_schedule_runs"]["Row"];

export type SourcesTable = Database["public"]["Tables"]["sources"];
export type ArticlesTable = Database["public"]["Tables"]["articles"];
export type ArticleAnalysesTable = Database["public"]["Tables"]["article_analyses"];
export type LogsTable = Database["public"]["Tables"]["logs"];
export type OxylabsSchedulesTable = Database["public"]["Tables"]["oxylabs_schedules"];
export type OxylabsScheduleRunsTable =
  Database["public"]["Tables"]["oxylabs_schedule_runs"];
