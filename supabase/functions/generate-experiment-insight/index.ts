const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_LABELS: Record<string, string> = {
  general: "General",
  meta: "Meta Ads",
  google_ads: "Google Ads",
  tiktok: "TikTok Ads",
  ga4: "Web / GA4",
  email: "Email",
  organico: "Orgánico",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { hypothesis, platform, kpi, description, baseline, final_value, variation_pct } = await req.json();

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY no configurado" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const platformLabel = PLATFORM_LABELS[platform] ?? platform;
    const variationStr = variation_pct > 0 ? `+${variation_pct.toFixed(1)}%` : `${variation_pct.toFixed(1)}%`;

    const prompt = `Sos un experto senior en marketing digital y growth para e-commerce. \
Analizá este experimento y generá un insight conciso y accionable en español rioplatense.

Hipótesis: ${hypothesis}
${description ? `Descripción: ${description}` : ""}
Plataforma: ${platformLabel}
KPI medido: ${kpi}
Valor base (antes del experimento): ${baseline}
Valor final (después del experimento): ${final_value}
Variación: ${variationStr}

Generá exactamente 2-3 oraciones que:
1. Interpreten qué significa esta variación en términos de negocio (no solo describas el número, interpretalo)
2. Determinen si el experimento fue exitoso, neutro o negativo y por qué
3. Recomienden la próxima acción concreta: escalar, iterar (qué cambiaría) o detener

Sé directo, específico y accionable. No uses bullet points ni encabezados. Escribí en flujo continuo.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const insight = data.content?.[0]?.text ?? "";

    return new Response(JSON.stringify({ insight }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
