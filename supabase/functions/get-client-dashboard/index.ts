import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (!token) {
      return new Response(JSON.stringify({ error: "Token requerido" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Validate token ──
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("client_access_tokens")
      .select("id, client_id, workspace_id, active, label, clients(name), workspaces(name)")
      .eq("token", token)
      .single();

    if (tokenErr || !tokenRow || !tokenRow.active) {
      return new Response(JSON.stringify({ error: "Link inválido o inactivo" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Update last_accessed_at (fire and forget)
    supabase
      .from("client_access_tokens")
      .update({ last_accessed_at: new Date().toISOString() })
      .eq("id", tokenRow.id)
      .then(() => {});

    const clientId = tokenRow.client_id;
    const wsId = tokenRow.workspace_id;
    const clientName = (tokenRow.clients as any)?.name ?? "Cliente";
    const workspaceName = (tokenRow.workspaces as any)?.name ?? "Agencia";

    // Default: last 30 days
    const toDate = to ?? new Date().toISOString().split("T")[0];
    const fromDate = from ?? (() => {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      return d.toISOString().split("T")[0];
    })();

    // ── Fetch performance ──
    const { data: rows } = await supabase
      .from("performance_daily")
      .select("date, provider, spend, revenue, impressions, clicks, purchases, sessions, users_count")
      .eq("workspace_id", wsId)
      .eq("client_id", clientId)
      .gte("date", fromDate)
      .lte("date", toDate)
      .order("date");

    // ── Fetch segment budgets ──
    const { data: segments } = await supabase
      .from("segments")
      .select("id, name, monthly_budget, currency")
      .eq("workspace_id", wsId)
      .eq("client_id", clientId)
      .gt("monthly_budget", 0);

    let budgets: any[] = [];
    if (segments?.length) {
      const { data: maps } = await supabase
        .from("campaign_segment_map")
        .select("segment_id, account_id")
        .in("segment_id", segments.map((s) => s.id));

      if (maps?.length) {
        const accountIds = [...new Set(maps.map((m: any) => m.account_id))];
        const mtdFrom = new Date();
        mtdFrom.setDate(1);
        const { data: mtdSpend } = await supabase
          .from("performance_daily")
          .select("account_id, spend")
          .eq("workspace_id", wsId)
          .in("account_id", accountIds)
          .gte("date", mtdFrom.toISOString().split("T")[0])
          .lte("date", toDate);

        const spendByAcc = new Map<string, number>();
        for (const r of mtdSpend ?? []) {
          spendByAcc.set(r.account_id, (spendByAcc.get(r.account_id) ?? 0) + (Number(r.spend) || 0));
        }

        budgets = segments.map((seg) => {
          const accs = maps.filter((m: any) => m.segment_id === seg.id).map((m: any) => m.account_id);
          const spendMTD = accs.reduce((s: number, a: string) => s + (spendByAcc.get(a) ?? 0), 0);
          return { ...seg, spendMTD, pct: seg.monthly_budget > 0 ? spendMTD / seg.monthly_budget : 0 };
        });
      }
    }

    return new Response(
      JSON.stringify({
        client: { id: clientId, name: clientName, workspace_name: workspaceName },
        rows: rows ?? [],
        budgets,
        period: { from: fromDate, to: toDate },
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
