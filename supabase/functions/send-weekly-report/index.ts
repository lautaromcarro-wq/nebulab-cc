import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Types ──────────────────────────────────────────────────────────────
interface Schedule {
  id: string;
  workspace_id: string;
  client_id: string | null;
  client_name: string | null;
  recipient_emails: string[];
  reply_to: string | null;
  subject_template: string | null;
  frequency: string;
  send_day_of_week: number;
  last_sent_at: string | null;
}

interface PerfRow {
  date: string;
  provider: string;
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  purchases: number;
  sessions: number;
  users_count: number;
}

// ── Date helpers ───────────────────────────────────────────────────────
function getPreviousWeekRange(): { from: string; to: string; label: string } {
  const today = new Date();
  // Go back to last Monday
  const dayOfWeek = today.getUTCDay(); // 0=Sun, 1=Mon...
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const lastMonday = new Date(today);
  lastMonday.setUTCDate(today.getUTCDate() - daysToLastMonday - 7);
  const lastSunday = new Date(lastMonday);
  lastSunday.setUTCDate(lastMonday.getUTCDate() + 6);

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const fmtDisplay = (d: Date) =>
    d.toLocaleDateString("es-AR", { day: "numeric", month: "long", timeZone: "UTC" });

  return {
    from: fmt(lastMonday),
    to: fmt(lastSunday),
    label: `${fmtDisplay(lastMonday)} – ${fmtDisplay(lastSunday)}`,
  };
}

// ── Email HTML builder ─────────────────────────────────────────────────
function fmtUSD(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);
}
function fmtK(n: number) {
  return n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1000
    ? `${(n / 1000).toFixed(1)}K`
    : String(Math.round(n));
}

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta Ads",
  google_ads: "Google Ads",
  tiktok: "TikTok Ads",
};
const PLATFORM_COLORS: Record<string, string> = {
  meta: "#1877F2",
  google_ads: "#34A853",
  tiktok: "#010101",
};

function buildEmailHTML(params: {
  clientName: string;
  periodLabel: string;
  from: string;
  to: string;
  rows: PerfRow[];
  reportUrl?: string;
  workspaceName?: string;
}): string {
  const { clientName, periodLabel, rows, reportUrl, workspaceName = "Nebulab" } = params;

  const adRows = rows.filter((r) => r.provider !== "ga4");
  const ga4Rows = rows.filter((r) => r.provider === "ga4");

  const totalSpend = adRows.reduce((s, r) => s + (Number(r.spend) || 0), 0);
  const totalRevenue = adRows.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
  const totalImpressions = adRows.reduce((s, r) => s + (Number(r.impressions) || 0), 0);
  const totalClicks = adRows.reduce((s, r) => s + (Number(r.clicks) || 0), 0);
  const totalPurchases = adRows.reduce((s, r) => s + (Number(r.purchases) || 0), 0);
  const blendedROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const totalSessions = ga4Rows.reduce((s, r) => s + (Number(r.sessions) || 0), 0);

  // Platform breakdown
  const platformMap = new Map<string, { spend: number; revenue: number; impressions: number; clicks: number; purchases: number }>();
  for (const r of adRows) {
    const ex = platformMap.get(r.provider) ?? { spend: 0, revenue: 0, impressions: 0, clicks: 0, purchases: 0 };
    ex.spend += Number(r.spend) || 0;
    ex.revenue += Number(r.revenue) || 0;
    ex.impressions += Number(r.impressions) || 0;
    ex.clicks += Number(r.clicks) || 0;
    ex.purchases += Number(r.purchases) || 0;
    platformMap.set(r.provider, ex);
  }

  const platforms = Array.from(platformMap.entries())
    .map(([provider, d]) => ({
      provider,
      label: PLATFORM_LABELS[provider] ?? provider,
      color: PLATFORM_COLORS[provider] ?? "#6366F1",
      ...d,
      roas: d.spend > 0 ? d.revenue / d.spend : 0,
      ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
    }))
    .sort((a, b) => b.spend - a.spend);

  const platformRows = platforms
    .map(
      (p) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px;vertical-align:middle;"></span>
          <strong>${p.label}</strong>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${fmtUSD(p.spend)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${fmtUSD(p.revenue)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#6366F1;">${p.roas.toFixed(2)}x</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${fmtK(p.impressions)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${p.ctr.toFixed(2)}%</td>
      </tr>
    `
    )
    .join("");

  const reportLinkSection = reportUrl
    ? `
    <div style="text-align:center;margin-top:32px;">
      <a href="${reportUrl}" style="background:#6366F1;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">
        Ver reporte completo →
      </a>
    </div>`
    : "";

  const ga4Section = totalSessions > 0
    ? `
    <div style="margin-top:24px;background:#f8fafc;border-radius:12px;padding:20px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em;">Web (GA4)</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="text-align:center;padding:8px;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#111827;">${fmtK(totalSessions)}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#6B7280;">Sesiones</p>
          </td>
          <td style="text-align:center;padding:8px;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#111827;">${totalSessions > 0 ? ((totalPurchases / totalSessions) * 100).toFixed(2) : "—"}%</p>
            <p style="margin:4px 0 0;font-size:11px;color:#6B7280;">Conv. rate</p>
          </td>
        </tr>
      </table>
    </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Reporte semanal — ${clientName}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366F1,#8B5CF6);border-radius:16px 16px 0 0;padding:32px 32px 28px;">
            <p style="margin:0 0 4px;color:rgba(255,255,255,0.7);font-size:11px;text-transform:uppercase;letter-spacing:0.1em;">${workspaceName}</p>
            <h1 style="margin:0 0 8px;color:white;font-size:24px;font-weight:700;">Resultados de la semana</h1>
            <p style="margin:0;color:rgba(255,255,255,0.8);font-size:14px;">${clientName} · ${periodLabel}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:white;padding:32px;border-radius:0 0 16px 16px;border:1px solid #e5e7eb;border-top:none;">

            <!-- KPI Grid -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td width="25%" style="padding:0 6px 0 0;">
                  <div style="background:#fafafa;border:1px solid #f0f0f0;border-radius:10px;padding:16px;text-align:center;">
                    <p style="margin:0;font-size:20px;font-weight:700;color:#111827;">${fmtUSD(totalSpend)}</p>
                    <p style="margin:6px 0 0;font-size:11px;color:#6B7280;">Inversión</p>
                  </div>
                </td>
                <td width="25%" style="padding:0 6px;">
                  <div style="background:#fafafa;border:1px solid #f0f0f0;border-radius:10px;padding:16px;text-align:center;">
                    <p style="margin:0;font-size:20px;font-weight:700;color:#111827;">${fmtUSD(totalRevenue)}</p>
                    <p style="margin:6px 0 0;font-size:11px;color:#6B7280;">Revenue</p>
                  </div>
                </td>
                <td width="25%" style="padding:0 6px;">
                  <div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:10px;padding:16px;text-align:center;">
                    <p style="margin:0;font-size:20px;font-weight:700;color:#6366F1;">${blendedROAS.toFixed(2)}x</p>
                    <p style="margin:6px 0 0;font-size:11px;color:#6366F1;">ROAS blended</p>
                  </div>
                </td>
                <td width="25%" style="padding:0 0 0 6px;">
                  <div style="background:#fafafa;border:1px solid #f0f0f0;border-radius:10px;padding:16px;text-align:center;">
                    <p style="margin:0;font-size:20px;font-weight:700;color:#111827;">${fmtK(totalPurchases)}</p>
                    <p style="margin:6px 0 0;font-size:11px;color:#6B7280;">Compras</p>
                  </div>
                </td>
              </tr>
            </table>

            <!-- Platform table -->
            ${platforms.length > 0 ? `
            <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em;">Performance por plataforma</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0f0f0;border-radius:10px;overflow:hidden;font-size:13px;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:10px 12px;text-align:left;font-weight:600;color:#6B7280;font-size:11px;text-transform:uppercase;">Plataforma</th>
                  <th style="padding:10px 12px;text-align:right;font-weight:600;color:#6B7280;font-size:11px;text-transform:uppercase;">Inversión</th>
                  <th style="padding:10px 12px;text-align:right;font-weight:600;color:#6B7280;font-size:11px;text-transform:uppercase;">Revenue</th>
                  <th style="padding:10px 12px;text-align:right;font-weight:600;color:#6B7280;font-size:11px;text-transform:uppercase;">ROAS</th>
                  <th style="padding:10px 12px;text-align:right;font-weight:600;color:#6B7280;font-size:11px;text-transform:uppercase;">Impresiones</th>
                  <th style="padding:10px 12px;text-align:right;font-weight:600;color:#6B7280;font-size:11px;text-transform:uppercase;">CTR</th>
                </tr>
              </thead>
              <tbody>${platformRows}</tbody>
            </table>` : ""}

            ${ga4Section}
            ${reportLinkSection}

            <!-- Footer -->
            <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f0f0f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">
                Reporte generado automáticamente por <strong style="color:#6366F1;">${workspaceName}</strong>
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#D1D5DB;">Powered by Nebulab OS</p>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Main handler ───────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const { schedule_id, cron } = body as { schedule_id?: string; cron?: boolean };

    // Fetch schedules to process
    let query = supabase
      .from("report_schedules")
      .select("*")
      .eq("active", true);

    if (schedule_id) {
      query = query.eq("id", schedule_id);
    } else if (cron) {
      // Cron mode: only weekly schedules (monthly handled separately)
      query = query.eq("frequency", "weekly");
    } else {
      // Manual run without specific ID: return list instead
      const { data } = await supabase
        .from("report_schedules")
        .select("id, client_name, recipient_emails, frequency, last_sent_at")
        .eq("active", true);
      return new Response(JSON.stringify({ schedules: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: schedules, error: schedError } = await query;
    if (schedError) throw schedError;
    if (!schedules?.length) {
      return new Response(JSON.stringify({ sent: 0, message: "No schedules found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const week = getPreviousWeekRange();
    const results: { schedule_id: string; status: string; error?: string }[] = [];

    for (const schedule of schedules as Schedule[]) {
      try {
        if (!schedule.recipient_emails?.length) {
          results.push({ schedule_id: schedule.id, status: "skipped", error: "No recipients" });
          continue;
        }

        // Fetch performance data
        let perfQuery = supabase
          .from("performance_daily")
          .select("date, provider, spend, revenue, impressions, clicks, purchases, sessions, users_count")
          .eq("workspace_id", schedule.workspace_id)
          .gte("date", week.from)
          .lte("date", week.to);

        if (schedule.client_id) {
          perfQuery = perfQuery.eq("client_id", schedule.client_id);
        }

        const { data: rows } = await perfQuery;
        const perfRows = (rows ?? []) as PerfRow[];

        // Build optional report URL (generate a token-based shareable link)
        let reportUrl: string | undefined;
        if (perfRows.length > 0) {
          const token = crypto.randomUUID();
          const adRows = perfRows.filter((r) => r.provider !== "ga4");
          const totalSpend = adRows.reduce((s, r) => s + (Number(r.spend) || 0), 0);
          const totalRevenue = adRows.reduce((s, r) => s + (Number(r.revenue) || 0), 0);

          await supabase.from("client_reports").insert({
            token,
            workspace_id: schedule.workspace_id,
            client_id: schedule.client_id,
            client_name: schedule.client_name,
            date_from: week.from,
            date_to: week.to,
            title: `Reporte semanal ${schedule.client_name ?? ""} — ${week.label}`,
            report_data: {
              kpis: {
                spend: totalSpend,
                revenue: totalRevenue,
                roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
                impressions: adRows.reduce((s, r) => s + (Number(r.impressions) || 0), 0),
                clicks: adRows.reduce((s, r) => s + (Number(r.clicks) || 0), 0),
                purchases: adRows.reduce((s, r) => s + (Number(r.purchases) || 0), 0),
              },
              platforms: [],
              daily: [],
              period: { from: week.from, to: week.to },
              client_name: schedule.client_name,
            },
          });
          const appUrl = Deno.env.get("APP_URL") ?? supabaseUrl.replace(".supabase.co", "");
          reportUrl = `${appUrl}/report/${token}`;
        }

        // Build email HTML
        const html = buildEmailHTML({
          clientName: schedule.client_name ?? "Cliente",
          periodLabel: week.label,
          from: week.from,
          to: week.to,
          rows: perfRows,
          reportUrl,
          workspaceName: "Nebulab",
        });

        const subject = schedule.subject_template
          ? schedule.subject_template
              .replace("{{client_name}}", schedule.client_name ?? "")
              .replace("{{week}}", week.label)
          : `📊 Resultados de la semana — ${schedule.client_name ?? "tu cuenta"} (${week.label})`;

        // Send via Resend
        if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Nebulab Reports <reports@resend.dev>",
            to: schedule.recipient_emails,
            reply_to: schedule.reply_to ?? undefined,
            subject,
            html,
          }),
        });

        if (!emailRes.ok) {
          const err = await emailRes.text();
          throw new Error(`Resend error: ${err}`);
        }

        // Log success + update last_sent_at
        await Promise.all([
          supabase.from("sent_report_log").insert({
            schedule_id: schedule.id,
            workspace_id: schedule.workspace_id,
            client_id: schedule.client_id,
            client_name: schedule.client_name,
            recipient_emails: schedule.recipient_emails,
            period_from: week.from,
            period_to: week.to,
            status: "sent",
          }),
          supabase
            .from("report_schedules")
            .update({ last_sent_at: new Date().toISOString() })
            .eq("id", schedule.id),
        ]);

        results.push({ schedule_id: schedule.id, status: "sent" });
      } catch (err: any) {
        // Log failure
        await supabase.from("sent_report_log").insert({
          schedule_id: schedule.id,
          workspace_id: schedule.workspace_id,
          client_id: schedule.client_id,
          client_name: schedule.client_name,
          recipient_emails: schedule.recipient_emails,
          period_from: week.from,
          period_to: week.to,
          status: "failed",
          error_message: err?.message ?? String(err),
        });
        results.push({ schedule_id: schedule.id, status: "failed", error: err?.message });
      }
    }

    return new Response(JSON.stringify({ sent: results.filter((r) => r.status === "sent").length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
