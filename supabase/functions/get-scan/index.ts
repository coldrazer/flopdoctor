// GET ?id=<scan id>  → ScanView   (the app can also read the scans row directly; RLS allows select)
import { admin, cors, json } from "../_shared/edge.ts";
import { rowToView, type ScanRow } from "../_shared/view.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ error: "id required" }, 400);
  const { data, error } = await admin().from("scans").select("*").eq("id", id).maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: "not found" }, 404);
  return json(rowToView(data as ScanRow));
});
