import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function fmtCurrency(n: number, currency = "USD"): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number): string {
  return `${n.toFixed(2)}%`;
}

// ── Context builders ────────────────────────────────────────────────────────

function buildClientContext(client: any): string {
  const lines = [
    `## Cliente: ${client.name}`,
    client.industria ? `- Industria: ${client.industria}` : null,
    client.website_url ? `- Web: ${client.website_url}` : null,
    client.status ? `- Estado: ${client.status}` : null,
    client.prioridad ? `- Prioridad: ${client.prioridad}` : null,
    client.responsable_nebulab
      ? `- Responsable: ${client.responsable_nebulab}`
      : null,
    client.fecha_kickoff ? `- Kickoff: ${client.fecha_kickoff}` : null,
    client.presupuesto_mensual_estimado
      ? `- Budget estimado: ${fmtCurrency(client.presupuesto_mensual_estimado)}`
      : null,
    client.notes ? `- Notas: ${client.notes}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

function buildMarcaContext(marca: any): string {
  if (!marca) return "";
  const lines = [
    `## Información de Marca`,
    marca.propuesta_valor
      ? `- Propuesta de valor: ${marca.propuesta_valor}`
      : null,
    marca.diferenciales ? `- Diferenciales: ${marca.diferenciales}` : null,
    marca.tono_comunicacion
      ? `- Tono de comunicación: ${marca.tono_comunicacion}`
      : null,
    marca.valores_marca ? `- Valores: ${marca.valores_marca}` : null,
    marca.publico_objetivo
      ? `- Público objetivo: ${marca.publico_objetivo}`
      : null,
    marca.historia_empresa ? `- Historia: ${marca.historia_empresa}` : null,
    marca.principales_clientes
      ? `- Principales clientes: ${marca.principales_clientes}`
      : null,
    marca.certificaciones
      ? `- Certificaciones: ${marca.certificaciones}`
      : null,
  ];
  return lines.filter(Boolean).join("\n");
}

function buildPersonasContext(personas: any[]): string {
  if (!personas?.length) return "";
  const blocks = personas.map((p) => {
    const lines = [
      `### ${p.name}`,
      p.demographics
        ? `- Demographics: ${JSON.stringify(p.demographics)}`
        : null,
      p.pain_points?.length
        ? `- Pain points: ${p.pain_points.join(", ")}`
        : null,
      p.objections?.length
        ? `- Objeciones: ${p.objections.join(", ")}`
        : null,
      p.jobs_to_be_done?.length
        ? `- Jobs to be done: ${p.jobs_to_be_done.join(", ")}`
        : null,
      p.channels?.length
        ? `- Canales preferidos: ${p.channels.join(", ")}`
        : null,
      p.notes ? `- Notas: ${p.notes}` : null,
    ];
    return lines.filter(Boolean).join("\n");
  });
  return `## Buyer Personas\n${blocks.join("\n\n")}`;
}

function buildCompetitorsContext(competitors: any[]): string {
  if (!competitors?.length) return "";
  const lines = competitors.map(
    (c) =>
      `- **${c.name}**${c.url ? ` (${c.url})` : ""}${c.notes ? `: ${c.notes}` : ""}`
  );
  return `## Competidores\n${lines.join("\n")}`;
}

function buildVerticalsContext(verticals: any[]): string {
  if (!verticals?.length) return "";
  const lines = verticals.map(
    (v) =>
      `- **${v.name}** (${v.business_model})${v.notes ? `: ${v.notes}` : ""}`
  );
  return `## Verticales de Negocio\n${lines.join("\n")}`;
}

function buildProductosContext(productos: any[]): string {
  if (!productos?.length) return "";
  const lines = productos.map((p) => {
    const tags = [];
    if (p.producto_estrella) tags.push("⭐ Estrella");
    if (p.producto_liquidacion) tags.push("🔥 Liquidación");
    if (p.producto_tactico) tags.push("🎯 Táctico");
    const tagStr = tags.length ? ` [${tags.join(", ")}]` : "";
    return `- **${p.nombre_producto}**${tagStr}: precio ${p.precio ? fmtCurrency(p.precio) : "N/A"}, costo ${p.costo ? fmtCurrency(p.costo) : "N/A"}, margen ${p.margen_percent ? fmtPct(p.margen_percent) : "N/A"}${p.categoria ? `, cat: ${p.categoria}` : ""}`;
  });
  return `## Productos\n${lines.join("\n")}`;
}

function buildFinancialContext(fin: any): string {
  if (!fin) return "";
  const lines = [
    `## Configuración Financiera`,
    `- COGS: ${fmtPct(fin.avg_cogs_percent ?? 0)}`,
    `- Envío: ${fmtPct(fin.shipping_percent ?? 0)}`,
    `- Comisión pago: ${fmtPct(fin.payment_fee_percent ?? 0)}`,
    `- Devoluciones: ${fmtPct(fin.refund_percent ?? 0)}`,
    `- IVA: ${fmtPct(fin.iva_percent ?? 0)}`,
  ];
  return lines.join("\n");
}

function buildCampaignPerformanceContext(
  campaigns: any[],
  performance: any[],
  segments: any[]
): string {
  if (!performance?.length) return "## Performance de Campañas\nSin datos de performance para el período.";

  // Aggregate performance by campaign
  const campMap = new Map(campaigns.map((c) => [c.id, c]));
  const segMap = new Map(segments.map((s) => [s.id, s.name]));
  const agg = new Map<
    string,
    {
      name: string;
      provider: string;
      spend: number;
      impressions: number;
      clicks: number;
      purchases: number;
      revenue: number;
      days: number;
    }
  >();

  for (const row of performance) {
    const key = row.entity_id;
    const existing = agg.get(key);
    if (existing) {
      existing.spend += Number(row.spend) || 0;
      existing.impressions += Number(row.impressions) || 0;
      existing.clicks += Number(row.clicks) || 0;
      existing.purchases += Number(row.purchases) || 0;
      existing.revenue += Number(row.revenue) || 0;
      existing.days += 1;
    } else {
      const camp = campMap.get(key);
      agg.set(key, {
        name: camp?.name ?? key,
        provider: row.provider ?? camp?.provider ?? "unknown",
        spend: Number(row.spend) || 0,
        impressions: Number(row.impressions) || 0,
        clicks: Number(row.clicks) || 0,
        purchases: Number(row.purchases) || 0,
        revenue: Number(row.revenue) || 0,
        days: 1,
      });
    }
  }

  const sorted = Array.from(agg.values()).sort((a, b) => b.spend - a.spend);

  // Totals
  const totalSpend = sorted.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = sorted.reduce((s, c) => s + c.revenue, 0);
  const totalPurchases = sorted.reduce((s, c) => s + c.purchases, 0);
  const totalImpressions = sorted.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = sorted.reduce((s, c) => s + c.clicks, 0);

  const lines = [
    `## Performance de Campañas (Período seleccionado)`,
    `### Totales`,
    `- Spend total: ${fmtCurrency(totalSpend)}`,
    `- Revenue total: ${fmtCurrency(totalRevenue)}`,
    `- ROAS blended: ${totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) + "x" : "N/A"}`,
    `- Purchases: ${totalPurchases}`,
    `- Impresiones: ${totalImpressions.toLocaleString("es-AR")}`,
    `- Clicks: ${totalClicks.toLocaleString("es-AR")}`,
    `- CTR prom: ${totalImpressions > 0 ? fmtPct((totalClicks / totalImpressions) * 100) : "N/A"}`,
    `- CPA prom: ${totalPurchases > 0 ? fmtCurrency(totalSpend / totalPurchases) : "N/A"}`,
    ``,
    `### Detalle por Campaña (Top 20 por spend)`,
  ];

  // Show top 20 by spend
  for (const c of sorted.slice(0, 20)) {
    const roas = c.spend > 0 ? (c.revenue / c.spend).toFixed(2) : "N/A";
    const ctr =
      c.impressions > 0 ? fmtPct((c.clicks / c.impressions) * 100) : "N/A";
    const cpa = c.purchases > 0 ? fmtCurrency(c.spend / c.purchases) : "N/A";
    lines.push(
      `- [${c.provider}] **${c.name}**: spend ${fmtCurrency(c.spend)}, revenue ${fmtCurrency(c.revenue)}, ROAS ${roas}x, purchases ${c.purchases}, CTR ${ctr}, CPA ${cpa} (${c.days}d)`
    );
  }

  // Segments performance summary
  if (segments.length > 0) {
    lines.push(``, `### Segments / Brands`);
    for (const seg of segments) {
      lines.push(
        `- **${seg.name}**: budget ${fmtCurrency(seg.monthly_budget ?? 0, seg.currency ?? "USD")} (${seg.currency ?? "USD"})`
      );
    }
  }

  return lines.join("\n");
}

function buildChangelogContext(changelog: any[]): string {
  if (!changelog?.length) return "";
  const lines = changelog
    .slice(0, 15)
    .map(
      (c) =>
        `- [${c.created_at?.slice(0, 10)}] (${c.change_type}${c.platform ? ` · ${c.platform}` : ""}) **${c.title}**${c.description ? `: ${c.description}` : ""}${c.expected_impact ? ` → Impacto esperado: ${c.expected_impact}` : ""}`
    );
  return `## Últimos Cambios (Bitácora)\n${lines.join("\n")}`;
}

// ── System prompt builder ───────────────────────────────────────────────────

function buildSystemPrompt(scope: string): string {
  return `Sos un experto senior en marketing digital, performance marketing y growth para negocios digitales. Trabajás como el analista estratégico dentro de Nebulab, una unidad de Performance Marketing que opera para múltiples clientes.

Tu estilo de comunicación:
- Español rioplatense. Tuteás con "vos". Informal pero con sustancia.
- Directo al punto. Sin rodeos ni sycophancy.
- Pensamiento sistémico: no ves campañas aisladas, ves negocios.
- Altamente analítico: interpretás métricas y sacás conclusiones accionables.
- Siempre filtrás todo por: ¿esto genera apalancamiento? ¿esto compone? ¿esto mueve la aguja del negocio?

Tenés acceso al contexto COMPLETO del cliente: datos del negocio, buyer personas, competidores, productos, marca, finanzas, y métricas de campañas reales.

REGLAS:
- NUNCA inventés datos. Si no hay datos suficientes, decilo.
- Usá los datos reales que te doy para basar tus análisis.
- Cuando hablés de métricas, siempre poné el número concreto.
- Priorizá insights accionables sobre descripciones.
- Pensá como dueño de negocio, no como media buyer.

${scope === "campaign_review" ? "ENFOQUE: Revisión detallada de la performance de las campañas. Detectá qué funciona, qué no, y qué ajustes hacer. Priorizá por impacto en margen." : ""}${scope === "strategic_insight" ? "ENFOQUE: Análisis estratégico cruzando todos los datos del negocio con la performance. Buscá oportunidades de escala, riesgos, y palancas de crecimiento no explotadas." : ""}${scope === "anomaly_detection" ? "ENFOQUE: Detectá anomalías, cambios bruscos o tendencias inusuales en las métricas. Correlacioná con cambios registrados en la bitácora." : ""}${scope === "creative_analysis" ? "ENFOQUE: Analizá la performance desde el ángulo creativo. Cruzá datos de buyer personas con los resultados para sugerir nuevos ángulos y mensajes que resuenen." : ""}${scope === "budget_optimization" ? "ENFOQUE: Analizá la distribución de presupuesto vs resultados. Proponé redistribuciones concretas basadas en efficiency marginal." : ""}`;
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const {
      clientId,
      workspaceId,
      scope = "free",
      question,
      dateFrom,
      dateTo,
    } = await req.json();

    if (!clientId || !workspaceId) {
      return json({ error: "clientId y workspaceId son requeridos" }, 400);
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json({ error: "ANTHROPIC_API_KEY no configurado en Supabase secrets" }, 500);
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // ── Gather all context in parallel ─────────────────────────────────
    const [
      clientRes,
      marcaRes,
      personasRes,
      competitorsRes,
      verticalsRes,
      productosRes,
      financialRes,
      segmentsRes,
      campaignsRes,
      performanceRes,
      changelogRes,
    ] = await Promise.all([
      sb
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .eq("workspace_id", workspaceId)
        .single(),
      sb
        .from("client_marca_info")
        .select("*")
        .eq("client_id", clientId)
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      sb
        .from("buyer_personas")
        .select("*")
        .eq("client_id", clientId)
        .eq("workspace_id", workspaceId),
      sb
        .from("competitors")
        .select("*")
        .eq("client_id", clientId)
        .eq("workspace_id", workspaceId),
      sb
        .from("client_verticals")
        .select("*")
        .eq("client_id", clientId)
        .eq("workspace_id", workspaceId),
      sb
        .from("client_productos")
        .select("*")
        .eq("client_id", clientId)
        .eq("workspace_id", workspaceId)
        .order("producto_estrella", { ascending: false }),
      sb
        .from("client_financial_settings")
        .select("*")
        .eq("client_id", clientId)
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      sb
        .from("segments")
        .select("*")
        .eq("client_id", clientId)
        .eq("workspace_id", workspaceId),
      sb
        .from("campaigns")
        .select("id, name, provider, objective, status")
        .eq("workspace_id", workspaceId),
      sb
        .from("performance_daily")
        .select(
          "entity_id, provider, date, spend, impressions, clicks, purchases, revenue"
        )
        .eq("workspace_id", workspaceId)
        .eq("client_id", clientId)
        .eq("entity_type", "campaign")
        .gte("date", dateFrom || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0])
        .lte("date", dateTo || new Date().toISOString().split("T")[0])
        .order("date", { ascending: false }),
      sb
        .from("changelog")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

    if (clientRes.error || !clientRes.data) {
      return json({ error: "Cliente no encontrado" }, 404);
    }

    // ── Build context blocks ───────────────────────────────────────────
    const contextBlocks = [
      buildClientContext(clientRes.data),
      buildMarcaContext(marcaRes.data),
      buildPersonasContext(personasRes.data ?? []),
      buildCompetitorsContext(competitorsRes.data ?? []),
      buildVerticalsContext(verticalsRes.data ?? []),
      buildProductosContext(productosRes.data ?? []),
      buildFinancialContext(financialRes.data),
      buildCampaignPerformanceContext(
        campaignsRes.data ?? [],
        performanceRes.data ?? [],
        segmentsRes.data ?? []
      ),
      buildChangelogContext(changelogRes.data ?? []),
    ].filter(Boolean);

    const fullContext = contextBlocks.join("\n\n---\n\n");

    // ── Build messages ─────────────────────────────────────────────────
    const userMessage = `Acá tenés todo el contexto del cliente y sus datos de campañas:

${fullContext}

---

${question || "Hacé un análisis general de la situación del cliente: cómo vienen las campañas, qué oportunidades ves, y qué acciones concretas recomendás."}`;

    // ── Call Claude ─────────────────────────────────────────────────────
    const actionSchema = {
      name: "suggest_actions",
      description: "Sugiere acciones concretas basadas en el análisis. Cada acción debe ser específica, ejecutable y directamente relacionada con los datos.",
      input_schema: {
        type: "object",
        properties: {
          actions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["PAUSE_CAMPAIGN", "SCALE_BUDGET", "FLAG_CREATIVE", "REVIEW_AUDIENCE", "ADJUST_BID", "ALERT"],
                },
                target_id: { type: "string", description: "ID de la campaña o elemento afectado, si aplica" },
                target_name: { type: "string", description: "Nombre legible del elemento afectado" },
                label: { type: "string", description: "Texto del botón (máx 40 chars)" },
                reason: { type: "string", description: "Por qué se recomienda esta acción (1 oración)" },
              },
              required: ["type", "label", "reason"],
            },
            maxItems: 5,
          },
        },
        required: ["actions"],
      },
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2500,
        system: buildSystemPrompt(scope),
        tools: [actionSchema],
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${err}`);
    }

    const data = await response.json();

    // Extract text analysis and tool use separately
    const analysis = data.content?.find((b: any) => b.type === "text")?.text ?? "";
    const toolUse = data.content?.find((b: any) => b.type === "tool_use");
    const actions: any[] = toolUse?.input?.actions ?? [];

    return json({
      analysis,
      actions,
      context_summary: {
        client: clientRes.data.name,
        has_marca: !!marcaRes.data,
        personas_count: personasRes.data?.length ?? 0,
        competitors_count: competitorsRes.data?.length ?? 0,
        products_count: productosRes.data?.length ?? 0,
        campaigns_with_data: new Set(
          (performanceRes.data ?? []).map((r: any) => r.entity_id)
        ).size,
        changelog_entries: changelogRes.data?.length ?? 0,
        date_range: {
          from:
            dateFrom ||
            new Date(new Date().getFullYear(), new Date().getMonth(), 1)
              .toISOString()
              .split("T")[0],
          to: dateTo || new Date().toISOString().split("T")[0],
        },
      },
      model: "claude-sonnet-4-20250514",
      tokens_used: data.usage,
    });
  } catch (err: any) {
    console.error("ai-analyst error:", err);
    return json({ error: err.message }, 500);
  }
});
