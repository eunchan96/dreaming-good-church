// Generated from the local public schema. Run npm run types:generate; do not edit.
export type Json = string | number | boolean | null | {
    [key: string]: Json | undefined;
} | Json[];
export type Database = {
    "public": {
        Tables: {
            "bulletin_images": {
                Row: {
                    "alt": string;
                    "bytes": number;
                    "created_at": string;
                    "height": number;
                    "id": string;
                    "title": string;
                    "width": number;
                };
                ComputedFields: never;
                Insert: {
                    "alt": string;
                    "bytes": number;
                    "created_at"?: string;
                    "height": number;
                    "id": string;
                    "title": string;
                    "width": number;
                };
                Update: {
                    "alt"?: string;
                    "bytes"?: number;
                    "created_at"?: string;
                    "height"?: number;
                    "id"?: string;
                    "title"?: string;
                    "width"?: number;
                };
                Relationships: [
                ];
            };
            "bulletin_items": {
                Row: {
                    "body": string;
                    "bulletin_id": string;
                    "content": NonNullable<Json>;
                    "id": string;
                    "image_asset_id": string | null;
                    "kind": string;
                    "needs_review": boolean;
                    "position": number;
                    "print_page": number | null;
                    "review_on_copy": boolean;
                    "title": string;
                    "web_visible": boolean;
                };
                ComputedFields: never;
                Insert: {
                    "body"?: string;
                    "bulletin_id": string;
                    "content"?: NonNullable<Json>;
                    "id"?: string;
                    "image_asset_id"?: never;
                    "kind"?: string;
                    "needs_review"?: boolean;
                    "position": number;
                    "print_page"?: number | null;
                    "review_on_copy"?: boolean;
                    "title": string;
                    "web_visible"?: boolean;
                };
                Update: {
                    "body"?: string;
                    "bulletin_id"?: string;
                    "content"?: NonNullable<Json>;
                    "id"?: string;
                    "image_asset_id"?: never;
                    "kind"?: string;
                    "needs_review"?: boolean;
                    "position"?: number;
                    "print_page"?: number | null;
                    "review_on_copy"?: boolean;
                    "title"?: string;
                    "web_visible"?: boolean;
                };
                Relationships: [
                    {
                        foreignKeyName: "bulletin_items_bulletin_id_fkey";
                        columns: [
                            "bulletin_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "bulletins";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "bulletin_items_image_asset_id_fkey";
                        columns: [
                            "image_asset_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "bulletin_images";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "bulletins": {
                Row: {
                    "id": string;
                    "issue_number": number;
                    "revision": number;
                    "service_date": string;
                    "status": string;
                    "updated_at": string;
                };
                ComputedFields: never;
                Insert: {
                    "id"?: string;
                    "issue_number": number;
                    "revision"?: number;
                    "service_date": string;
                    "status"?: string;
                    "updated_at"?: string;
                };
                Update: {
                    "id"?: string;
                    "issue_number"?: number;
                    "revision"?: number;
                    "service_date"?: string;
                    "status"?: string;
                    "updated_at"?: string;
                };
                Relationships: [
                ];
            };
            "church_editors": {
                Row: {
                    "created_at": string;
                    "user_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "created_at"?: string;
                    "user_id": string;
                };
                Update: {
                    "created_at"?: string;
                    "user_id"?: string;
                };
                Relationships: [
                ];
            };
            "church_info": {
                Row: {
                    "body": string;
                    "key": string;
                    "revision": number;
                    "web_visible": boolean;
                };
                ComputedFields: never;
                Insert: {
                    "body"?: string;
                    "key": string;
                    "revision"?: number;
                    "web_visible"?: boolean;
                };
                Update: {
                    "body"?: string;
                    "key"?: string;
                    "revision"?: number;
                    "web_visible"?: boolean;
                };
                Relationships: [
                ];
            };
            "community_entries": {
                Row: {
                    "body": string;
                    "ends_at": string | null;
                    "id": string;
                    "is_public": boolean;
                    "kind": string;
                    "location": string;
                    "publish_from": string | null;
                    "publish_until": string | null;
                    "revision": number;
                    "sensitive": boolean;
                    "source_bulletin_id": string | null;
                    "source_item_id": string | null;
                    "starts_at": string | null;
                    "status": string;
                    "title": string;
                    "updated_at": string;
                };
                ComputedFields: never;
                Insert: {
                    "body"?: string;
                    "ends_at"?: string | null;
                    "id"?: string;
                    "is_public"?: boolean;
                    "kind": string;
                    "location"?: string;
                    "publish_from"?: string | null;
                    "publish_until"?: string | null;
                    "revision"?: number;
                    "sensitive"?: boolean;
                    "source_bulletin_id"?: string | null;
                    "source_item_id"?: string | null;
                    "starts_at"?: string | null;
                    "status"?: string;
                    "title": string;
                    "updated_at"?: string;
                };
                Update: {
                    "body"?: string;
                    "ends_at"?: string | null;
                    "id"?: string;
                    "is_public"?: boolean;
                    "kind"?: string;
                    "location"?: string;
                    "publish_from"?: string | null;
                    "publish_until"?: string | null;
                    "revision"?: number;
                    "sensitive"?: boolean;
                    "source_bulletin_id"?: string | null;
                    "source_item_id"?: string | null;
                    "starts_at"?: string | null;
                    "status"?: string;
                    "title"?: string;
                    "updated_at"?: string;
                };
                Relationships: [
                ];
            };
            "worship_videos": {
                Row: {
                    "featured": boolean;
                    "id": string;
                    "revision": number;
                    "service_date": string;
                    "service_type": string;
                    "status": string;
                    "title": string;
                    "updated_at": string;
                    "video_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "featured"?: boolean;
                    "id"?: string;
                    "revision"?: number;
                    "service_date": string;
                    "service_type": string;
                    "status"?: string;
                    "title": string;
                    "updated_at"?: string;
                    "video_id": string;
                };
                Update: {
                    "featured"?: boolean;
                    "id"?: string;
                    "revision"?: number;
                    "service_date"?: string;
                    "service_type"?: string;
                    "status"?: string;
                    "title"?: string;
                    "updated_at"?: string;
                    "video_id"?: string;
                };
                Relationships: [
                ];
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            "copy_bulletin_draft": {
                Args: {
                    "p_issue_number": number;
                    "p_service_date": string;
                    "p_source": string;
                };
                Returns: {
                    "id": string;
                    "issue_number": number;
                    "revision": number;
                    "service_date": string;
                    "status": string;
                    "updated_at": string;
                };
                SetofOptions: {
                    from: "*";
                    to: "bulletins";
                    isOneToOne: true;
                    isSetofReturn: false;
                };
            };
            "copy_community_to_bulletin": {
                Args: {
                    "p_bulletin": string;
                    "p_entry": string;
                    "p_revision": number;
                };
                Returns: {
                    "id": string;
                    "issue_number": number;
                    "revision": number;
                    "service_date": string;
                    "status": string;
                    "updated_at": string;
                };
                SetofOptions: {
                    from: "*";
                    to: "bulletins";
                    isOneToOne: true;
                    isSetofReturn: false;
                };
            };
            "create_notice_from_bulletin": {
                Args: {
                    "p_bulletin": string;
                    "p_item": string;
                    "p_revision": number;
                };
                Returns: {
                    "body": string;
                    "ends_at": string | null;
                    "id": string;
                    "is_public": boolean;
                    "kind": string;
                    "location": string;
                    "publish_from": string | null;
                    "publish_until": string | null;
                    "revision": number;
                    "sensitive": boolean;
                    "source_bulletin_id": string | null;
                    "source_item_id": string | null;
                    "starts_at": string | null;
                    "status": string;
                    "title": string;
                    "updated_at": string;
                };
                SetofOptions: {
                    from: "*";
                    to: "community_entries";
                    isOneToOne: true;
                    isSetofReturn: false;
                };
            };
            "save_bulletin_draft": {
                Args: {
                    "p_id": string;
                    "p_issue_number": number;
                    "p_items": Json;
                    "p_revision": number;
                    "p_service_date": string;
                };
                Returns: {
                    "id": string;
                    "issue_number": number;
                    "revision": number;
                    "service_date": string;
                    "status": string;
                    "updated_at": string;
                };
                SetofOptions: {
                    from: "*";
                    to: "bulletins";
                    isOneToOne: true;
                    isSetofReturn: false;
                };
            };
            "save_church_info": {
                Args: {
                    "p_fields": Json;
                };
                Returns: {
                    "body": string;
                    "key": string;
                    "revision": number;
                    "web_visible": boolean;
                }[];
                SetofOptions: {
                    from: "*";
                    to: "church_info";
                    isOneToOne: false;
                    isSetofReturn: true;
                };
            };
            "save_community_entry": {
                Args: {
                    "p_entry": Json;
                    "p_id": string;
                    "p_revision": number;
                };
                Returns: {
                    "body": string;
                    "ends_at": string | null;
                    "id": string;
                    "is_public": boolean;
                    "kind": string;
                    "location": string;
                    "publish_from": string | null;
                    "publish_until": string | null;
                    "revision": number;
                    "sensitive": boolean;
                    "source_bulletin_id": string | null;
                    "source_item_id": string | null;
                    "starts_at": string | null;
                    "status": string;
                    "title": string;
                    "updated_at": string;
                };
                SetofOptions: {
                    from: "*";
                    to: "community_entries";
                    isOneToOne: true;
                    isSetofReturn: false;
                };
            };
            "save_worship_video": {
                Args: {
                    "p_date": string;
                    "p_featured": boolean;
                    "p_id": string;
                    "p_revision": number;
                    "p_status": string;
                    "p_title": string;
                    "p_type": string;
                    "p_video": string;
                };
                Returns: {
                    "featured": boolean;
                    "id": string;
                    "revision": number;
                    "service_date": string;
                    "service_type": string;
                    "status": string;
                    "title": string;
                    "updated_at": string;
                    "video_id": string;
                };
                SetofOptions: {
                    from: "*";
                    to: "worship_videos";
                    isOneToOne: true;
                    isSetofReturn: false;
                };
            };
            "set_bulletin_publication": {
                Args: {
                    "p_id": string;
                    "p_publish": boolean;
                    "p_revision": number;
                };
                Returns: {
                    "id": string;
                    "issue_number": number;
                    "revision": number;
                    "service_date": string;
                    "status": string;
                    "updated_at": string;
                };
                SetofOptions: {
                    from: "*";
                    to: "bulletins";
                    isOneToOne: true;
                    isSetofReturn: false;
                };
            };
            "valid_bulletin_content": {
                Args: {
                    "content": Json;
                    "kind": string;
                };
                Returns: boolean;
            };
            "valid_text_bulletin_content": {
                Args: {
                    "content": Json;
                    "kind": string;
                };
                Returns: boolean;
            };
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};
type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];
export type Tables<DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"]) : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
    Row: infer R;
} ? R : never : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
    Row: infer R;
} ? R : never : never;
export type TablesInsert<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I;
} ? I : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I;
} ? I : never : never;
export type TablesUpdate<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U;
} ? U : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U;
} ? U : never : never;
export type Enums<DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | {
    schema: keyof DatabaseWithoutInternals;
}, EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"] : never = never> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName] : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions] : never;
export type CompositeTypes<PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] | {
    schema: keyof DatabaseWithoutInternals;
}, CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"] : never = never> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName] : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions] : never;
export const Constants = {
    "public": {
        Enums: {}
    }
} as const;
