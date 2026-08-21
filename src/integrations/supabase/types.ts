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
      commentary_scores: {
        Row: {
          computed_at: string
          explanation: string | null
          movie_id: string
          score: number
          signals: Json
          user_id: string
        }
        Insert: {
          computed_at?: string
          explanation?: string | null
          movie_id: string
          score: number
          signals?: Json
          user_id: string
        }
        Update: {
          computed_at?: string
          explanation?: string | null
          movie_id?: string
          score?: number
          signals?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commentary_scores_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
        ]
      }
      episode_link_flags: {
        Row: {
          created_at: string
          episode_id: string
          flagged_by: string | null
          id: string
          movie_id: string
          note: string | null
          resolution: string | null
          resolved_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          episode_id: string
          flagged_by?: string | null
          id?: string
          movie_id: string
          note?: string | null
          resolution?: string | null
          resolved_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          episode_id?: string
          flagged_by?: string | null
          id?: string
          movie_id?: string
          note?: string | null
          resolution?: string | null
          resolved_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "episode_link_flags_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "podcast_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episode_link_flags_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
        ]
      }
      episode_match_rejections: {
        Row: {
          created_at: string
          episode_id: string
          movie_id: string
          rejected_by: string | null
        }
        Insert: {
          created_at?: string
          episode_id: string
          movie_id: string
          rejected_by?: string | null
        }
        Update: {
          created_at?: string
          episode_id?: string
          movie_id?: string
          rejected_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "episode_match_rejections_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "podcast_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episode_match_rejections_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
        ]
      }
      episode_movies: {
        Row: {
          episode_id: string
          is_primary_subject: boolean
          match_confidence: number
          match_method: Database["public"]["Enums"]["match_method"]
          movie_id: string
          signals: Json
        }
        Insert: {
          episode_id: string
          is_primary_subject?: boolean
          match_confidence?: number
          match_method?: Database["public"]["Enums"]["match_method"]
          movie_id: string
          signals?: Json
        }
        Update: {
          episode_id?: string
          is_primary_subject?: boolean
          match_confidence?: number
          match_method?: Database["public"]["Enums"]["match_method"]
          movie_id?: string
          signals?: Json
        }
        Relationships: [
          {
            foreignKeyName: "episode_movies_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "podcast_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episode_movies_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
        ]
      }
      episode_sources: {
        Row: {
          access_tier: Database["public"]["Enums"]["source_access_tier"]
          embeddable: boolean
          episode_id: string
          id: string
          is_primary: boolean
          platform: string
          url: string
        }
        Insert: {
          access_tier?: Database["public"]["Enums"]["source_access_tier"]
          embeddable?: boolean
          episode_id: string
          id?: string
          is_primary?: boolean
          platform: string
          url: string
        }
        Update: {
          access_tier?: Database["public"]["Enums"]["source_access_tier"]
          embeddable?: boolean
          episode_id?: string
          id?: string
          is_primary?: boolean
          platform?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "episode_sources_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "podcast_episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      genres: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      match_actions: {
        Row: {
          action: Database["public"]["Enums"]["match_action"]
          actor_id: string | null
          created_at: string
          episode_id: string
          id: string
          movie_id: string | null
          previous_confidence: number | null
          previous_method: Database["public"]["Enums"]["match_method"] | null
          previous_movie_id: string | null
          undone_at: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["match_action"]
          actor_id?: string | null
          created_at?: string
          episode_id: string
          id?: string
          movie_id?: string | null
          previous_confidence?: number | null
          previous_method?: Database["public"]["Enums"]["match_method"] | null
          previous_movie_id?: string | null
          undone_at?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["match_action"]
          actor_id?: string | null
          created_at?: string
          episode_id?: string
          id?: string
          movie_id?: string | null
          previous_confidence?: number | null
          previous_method?: Database["public"]["Enums"]["match_method"] | null
          previous_movie_id?: string | null
          undone_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_actions_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "podcast_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_actions_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_actions_previous_movie_id_fkey"
            columns: ["previous_movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
        ]
      }
      movie_availability: {
        Row: {
          deep_link: string | null
          id: string
          last_checked_at: string
          movie_id: string
          offer_type: Database["public"]["Enums"]["offer_type"]
          provider_source: string
          region: string
          service_id: string
        }
        Insert: {
          deep_link?: string | null
          id?: string
          last_checked_at?: string
          movie_id: string
          offer_type?: Database["public"]["Enums"]["offer_type"]
          provider_source?: string
          region?: string
          service_id: string
        }
        Update: {
          deep_link?: string | null
          id?: string
          last_checked_at?: string
          movie_id?: string
          offer_type?: Database["public"]["Enums"]["offer_type"]
          provider_source?: string
          region?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movie_availability_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movie_availability_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "streaming_services"
            referencedColumns: ["id"]
          },
        ]
      }
      movie_genres: {
        Row: {
          genre_id: string
          movie_id: string
        }
        Insert: {
          genre_id: string
          movie_id: string
        }
        Update: {
          genre_id?: string
          movie_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movie_genres_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movie_genres_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
        ]
      }
      movies: {
        Row: {
          accent: string
          availability_checked_at: string | null
          backdrop_url: string | null
          created_at: string
          id: string
          imdb_id: string | null
          media_type: Database["public"]["Enums"]["media_type"]
          poster_url: string | null
          release_date: string | null
          release_year: number | null
          runtime_minutes: number | null
          slug: string
          synopsis: string | null
          tagline: string | null
          title: string
          tmdb_id: number | null
        }
        Insert: {
          accent?: string
          availability_checked_at?: string | null
          backdrop_url?: string | null
          created_at?: string
          id?: string
          imdb_id?: string | null
          media_type?: Database["public"]["Enums"]["media_type"]
          poster_url?: string | null
          release_date?: string | null
          release_year?: number | null
          runtime_minutes?: number | null
          slug: string
          synopsis?: string | null
          tagline?: string | null
          title: string
          tmdb_id?: number | null
        }
        Update: {
          accent?: string
          availability_checked_at?: string | null
          backdrop_url?: string | null
          created_at?: string
          id?: string
          imdb_id?: string | null
          media_type?: Database["public"]["Enums"]["media_type"]
          poster_url?: string | null
          release_date?: string | null
          release_year?: number | null
          runtime_minutes?: number | null
          slug?: string
          synopsis?: string | null
          tagline?: string | null
          title?: string
          tmdb_id?: number | null
        }
        Relationships: []
      }
      podcast_episodes: {
        Row: {
          created_at: string
          description: string | null
          disposition: Database["public"]["Enums"]["episode_disposition"]
          duration_seconds: number | null
          episode_number: number | null
          id: string
          podcast_id: string
          provider_source: string
          released_at: string | null
          slug: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          disposition?: Database["public"]["Enums"]["episode_disposition"]
          duration_seconds?: number | null
          episode_number?: number | null
          id?: string
          podcast_id: string
          provider_source?: string
          released_at?: string | null
          slug: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          disposition?: Database["public"]["Enums"]["episode_disposition"]
          duration_seconds?: number | null
          episode_number?: number | null
          id?: string
          podcast_id?: string
          provider_source?: string
          released_at?: string | null
          slug?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "podcast_episodes_podcast_id_fkey"
            columns: ["podcast_id"]
            isOneToOne: false
            referencedRelation: "podcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_external_metrics: {
        Row: {
          external_url: string | null
          fetched_at: string
          id: string
          platform: string
          podcast_id: string
          rating: number | null
          rating_count: number | null
        }
        Insert: {
          external_url?: string | null
          fetched_at?: string
          id?: string
          platform: string
          podcast_id: string
          rating?: number | null
          rating_count?: number | null
        }
        Update: {
          external_url?: string | null
          fetched_at?: string
          id?: string
          platform?: string
          podcast_id?: string
          rating?: number | null
          rating_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "podcast_external_metrics_podcast_id_fkey"
            columns: ["podcast_id"]
            isOneToOne: false
            referencedRelation: "podcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      podcasts: {
        Row: {
          accent: string
          activity_status: Database["public"]["Enums"]["podcast_activity"]
          artwork_url: string | null
          created_at: string
          curation_status: Database["public"]["Enums"]["podcast_curation"]
          description: string | null
          episode_count: number
          external_ids: Json
          feed_url: string | null
          id: string
          latest_episode_at: string | null
          name: string
          provider_source: string
          slug: string
          website_url: string | null
        }
        Insert: {
          accent?: string
          activity_status?: Database["public"]["Enums"]["podcast_activity"]
          artwork_url?: string | null
          created_at?: string
          curation_status?: Database["public"]["Enums"]["podcast_curation"]
          description?: string | null
          episode_count?: number
          external_ids?: Json
          feed_url?: string | null
          id?: string
          latest_episode_at?: string | null
          name: string
          provider_source?: string
          slug: string
          website_url?: string | null
        }
        Update: {
          accent?: string
          activity_status?: Database["public"]["Enums"]["podcast_activity"]
          artwork_url?: string | null
          created_at?: string
          curation_status?: Database["public"]["Enums"]["podcast_curation"]
          description?: string | null
          episode_count?: number
          external_ids?: Json
          feed_url?: string | null
          id?: string
          latest_episode_at?: string | null
          name?: string
          provider_source?: string
          slug?: string
          website_url?: string | null
        }
        Relationships: []
      }
      streaming_services: {
        Row: {
          accent: string
          id: string
          name: string
          provider_ref: string | null
          short_name: string
          slug: string
          sort_order: number
        }
        Insert: {
          accent?: string
          id?: string
          name: string
          provider_ref?: string | null
          short_name: string
          slug: string
          sort_order?: number
        }
        Update: {
          accent?: string
          id?: string
          name?: string
          provider_ref?: string | null
          short_name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      user_episode_listening: {
        Row: {
          completed_at: string | null
          completion_percent: number | null
          duration_seconds: number | null
          episode_id: string
          position_seconds: number | null
          status: Database["public"]["Enums"]["listening_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completion_percent?: number | null
          duration_seconds?: number | null
          episode_id: string
          position_seconds?: number | null
          status?: Database["public"]["Enums"]["listening_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completion_percent?: number | null
          duration_seconds?: number | null
          episode_id?: string
          position_seconds?: number | null
          status?: Database["public"]["Enums"]["listening_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_episode_listening_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "podcast_episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_episode_ratings: {
        Row: {
          episode_id: string
          rating: Database["public"]["Enums"]["episode_rating"]
          updated_at: string
          user_id: string
        }
        Insert: {
          episode_id: string
          rating: Database["public"]["Enums"]["episode_rating"]
          updated_at?: string
          user_id: string
        }
        Update: {
          episode_id?: string
          rating?: Database["public"]["Enums"]["episode_rating"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_episode_ratings_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "podcast_episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_movie_watches: {
        Row: {
          created_at: string
          id: string
          movie_id: string
          note: string | null
          user_id: string
          watched_on: string
        }
        Insert: {
          created_at?: string
          id?: string
          movie_id: string
          note?: string | null
          user_id: string
          watched_on?: string
        }
        Update: {
          created_at?: string
          id?: string
          movie_id?: string
          note?: string | null
          user_id?: string
          watched_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_movie_watches_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_podcast_preferences: {
        Row: {
          podcast_id: string
          preference: Database["public"]["Enums"]["podcast_preference"]
          updated_at: string
          user_id: string
        }
        Insert: {
          podcast_id: string
          preference?: Database["public"]["Enums"]["podcast_preference"]
          updated_at?: string
          user_id: string
        }
        Update: {
          podcast_id?: string
          preference?: Database["public"]["Enums"]["podcast_preference"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_podcast_preferences_podcast_id_fkey"
            columns: ["podcast_id"]
            isOneToOne: false
            referencedRelation: "podcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_production_quality: {
        Row: {
          episode_id: string
          quality: Database["public"]["Enums"]["production_quality"]
          updated_at: string
          user_id: string
        }
        Insert: {
          episode_id: string
          quality: Database["public"]["Enums"]["production_quality"]
          updated_at?: string
          user_id: string
        }
        Update: {
          episode_id?: string
          quality?: Database["public"]["Enums"]["production_quality"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_production_quality_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "podcast_episodes"
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
      user_streaming_services: {
        Row: {
          created_at: string
          service_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          service_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          service_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_streaming_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "streaming_services"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist_movies: {
        Row: {
          added_at: string
          movie_id: string
          watchlist_id: string
        }
        Insert: {
          added_at?: string
          movie_id: string
          watchlist_id: string
        }
        Update: {
          added_at?: string
          movie_id?: string
          watchlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_movies_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_movies_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlists"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlists: {
        Row: {
          accent: string
          created_at: string
          description: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          accent?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          accent?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      episode_disposition:
        | "needs_review"
        | "movie_matched"
        | "not_about_a_movie"
      episode_rating: "disliked" | "meh" | "loved"
      listening_status: "not_started" | "started" | "finished"
      match_action:
        | "approve"
        | "reject"
        | "unlink"
        | "relink"
        | "confirm"
        | "not_about_a_movie"
      match_method: "seed" | "deterministic" | "heuristic" | "ai" | "manual"
      media_type: "movie" | "tv"
      offer_type: "subscription" | "free_ads" | "rent" | "buy"
      podcast_activity: "active" | "slow" | "dormant" | "ended"
      podcast_curation: "active" | "parked"
      podcast_preference: "preferred" | "neutral" | "blocked"
      production_quality: "poor" | "okay" | "good"
      source_access_tier: "public" | "premium" | "private"
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
      episode_disposition: [
        "needs_review",
        "movie_matched",
        "not_about_a_movie",
      ],
      episode_rating: ["disliked", "meh", "loved"],
      listening_status: ["not_started", "started", "finished"],
      match_action: [
        "approve",
        "reject",
        "unlink",
        "relink",
        "confirm",
        "not_about_a_movie",
      ],
      match_method: ["seed", "deterministic", "heuristic", "ai", "manual"],
      media_type: ["movie", "tv"],
      offer_type: ["subscription", "free_ads", "rent", "buy"],
      podcast_activity: ["active", "slow", "dormant", "ended"],
      podcast_curation: ["active", "parked"],
      podcast_preference: ["preferred", "neutral", "blocked"],
      production_quality: ["poor", "okay", "good"],
      source_access_tier: ["public", "premium", "private"],
    },
  },
} as const
