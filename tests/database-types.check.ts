import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "../lib/database.types";

// Compile-only contract checks: type generation must actually protect queries and RPC calls.
export function checkDatabaseContract(client: SupabaseClient<Database>) {
  client.from("bulletins").select("id,service_date");
  client.rpc("copy_bulletin_draft", { p_source: "id", p_service_date: "2026-11-22", p_issue_number: 4 });
  // @ts-expect-error Unknown tables must not silently become untyped clients.
  client.from("missing_table");
  // @ts-expect-error RPC arguments are generated from the schema.
  client.rpc("copy_bulletin_draft", { source: "id" });
  // @ts-expect-error Revision is a number, not a string.
  client.from("bulletins").update({ revision: "wrong" });
  // @ts-expect-error This FK column is generated from image content, never directly writable.
  const item: TablesInsert<"bulletin_items"> = { bulletin_id: "id", position: 0, title: "Image", image_asset_id: "id" };
  return item;
}
