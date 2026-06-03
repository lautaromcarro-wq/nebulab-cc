#!/usr/bin/env python3
"""Process MasterMetrics June 2026 data (days 1-3) and generate SQL."""
from collections import defaultdict

WORKSPACE = "a0000000-0000-0000-0000-000000000001"
CLIENTS = {
    "Diana":    "c0000001-0000-0000-0000-000000000001",
    "Spinit":   "c0000002-0000-0000-0000-000000000001",
    "Casabutik":"c0000003-0000-0000-0000-000000000001",
    "Trento":   "c0000004-0000-0000-0000-000000000001",
    "Shilba":   "c0000005-0000-0000-0000-000000000001",
    "Infoauto": "c0000006-0000-0000-0000-000000000001",
    "GrupoMF":  "c0000007-0000-0000-0000-000000000001",
}
ACCOUNTS = {
    ("Diana","meta"):      "ac000001-0001-0000-0000-000000000001",
    ("Diana","google_ads"):"ac000001-0002-0000-0000-000000000001",
    ("Spinit","meta"):     "ac000002-0001-0000-0000-000000000001",
    ("Spinit","google_ads"):"ac000002-0002-0000-0000-000000000001",
    ("Casabutik","meta"):  "ac000003-0001-0000-0000-000000000001",
    ("Casabutik","google_ads"):"ac000003-0002-0000-0000-000000000001",
    ("Trento","meta"):     "ac000004-0001-0000-0000-000000000001",
    ("Trento","google_ads"):"ac000004-0002-0000-0000-000000000001",
    ("Infoauto","meta"):   "ac000006-0001-0000-0000-000000000001",
    ("Infoauto","google_ads"):"ac000006-0002-0000-0000-000000000001",
    ("GrupoMF","meta"):    "ac000007-0001-0000-0000-000000000001",
    ("GrupoMF","google_ads"):"ac000007-0002-0000-0000-000000000001",
}

def classify(campaign):
    c = campaign.upper()
    if "CASABUTIK" in c or "CASA_BUTIK" in c: return "Casabutik"
    if "DIANA" in c or "SHILB" in c: return "Diana"
    if "SPINIT" in c: return "Spinit"
    if "TRENTO" in c: return "Trento"
    if "INFOAUTO" in c or "NEXO" in c: return "Infoauto"
    if "GRUPOMF" in c: return "GrupoMF"
    return None

def parse_date(d):
    if "/" in d:
        mm, dd, yyyy = d.split("/")
        return f"{yyyy}-{mm.zfill(2)}-{dd.zfill(2)}"
    return d

# Aggregation: (client, date, provider) -> metrics
perf = defaultdict(lambda: {"spend":0,"impressions":0,"clicks":0,"reach":0,"purchases":0,"revenue":0})

# ── META BARALDO ──────────────────────────────────────────────────────────
meta_baraldo = [
    ["C3_DIANA_RT_CAT_PERFORMANCE","06/01/2026","10230.0900","4007","2083","63","2","644486.0300"],
    ["C3_DIANA_RT_CAT_PERFORMANCE","06/02/2026","14949.8400","6173","2937","66","1","537000"],
    ["C3_DIANA_RT_CAT_PERFORMANCE","06/03/2026","3070.3900","1216","797","13","0","0"],
    ["C5_DIANA_PR_INT_ORG_AWARENESS","06/01/2026","5301.4700","7084","7080","17","0","0"],
    ["C5_DIANA_PR_INT_ORG_AWARENESS","06/02/2026","6345.5200","10841","10206","17","0","0"],
    ["C5_DIANA_PR_INT_ORG_AWARENESS","06/03/2026","1902.5000","3305","3160","8","0","0"],
    ["C1_SPINIT_PR_PERFORMANCE_SCALE","06/01/2026","16611.1600","8709","5049","196","0","0"],
    ["C1_SPINIT_PR_PERFORMANCE_SCALE","06/02/2026","23071.7700","11829","5851","243","0","0"],
    ["C1_SPINIT_PR_PERFORMANCE_SCALE","06/03/2026","5299.2800","2707","1784","42","1","171080"],
    ["C6_SPINIT_PR_INT_ORG_AWARENESS","06/01/2026","4552.9700","7850","7725","1","0","0"],
    ["C6_SPINIT_PR_INT_ORG_AWARENESS","06/02/2026","7735.6300","13766","13119","16","0","0"],
    ["C6_SPINIT_PR_INT_ORG_AWARENESS","06/03/2026","3424.2300","6212","6197","4","0","0"],
    ["C5_SPINIT_INT_VC_AWARENESS","06/01/2026","13543.9600","35784","34125","78","0","0"],
    ["C5_SPINIT_INT_VC_AWARENESS","06/02/2026","20965.7000","14602","10873","378","0","0"],
    ["C5_SPINIT_INT_VC_AWARENESS","06/03/2026","5793.8700","4055","3413","100","0","0"],
    ["C5_CASABUTIK_PR_VC_AWARENESS","06/01/2026","8750","6791","6560","27","0","0"],
    ["C5_CASABUTIK_PR_VC_AWARENESS","06/02/2026","8732.3500","3146","3146","27","0","0"],
    ["C5_CASABUTIK_PR_VC_AWARENESS","06/03/2026","6919.2000","2735","2637","12","0","0"],
    ["C2_CASABUTIK_PR_PERFORMANCE_SCALE","06/01/2026","49542.7600","6060","3773","78","3","1643386.0300"],
    ["C2_CASABUTIK_PR_PERFORMANCE_SCALE","06/02/2026","42258.0200","5378","3107","77","1","226000"],
    ["C2_CASABUTIK_PR_PERFORMANCE_SCALE","06/03/2026","7630.6100","839","672","12","0","0"],
    ["C4_CASABUTIK_PR_EST_ATC_AWARENESS","06/01/2026","7191.0900","1271","1157","68","0","0"],
    ["C4_CASABUTIK_PR_EST_ATC_AWARENESS","06/02/2026","7481.8700","1370","1242","85","0","0"],
    ["C4_CASABUTIK_PR_EST_ATC_AWARENESS","06/03/2026","2592.1400","425","415","21","0","0"],
    ["C6_CASABUTIK_INT_ORG_AWARENESS","06/01/2026","4778.3600","6790","6467","17","0","0"],
    ["C6_CASABUTIK_INT_ORG_AWARENESS","06/02/2026","3612.4200","5200","5050","11","0","0"],
    ["C6_CASABUTIK_INT_ORG_AWARENESS","06/03/2026","3047.4900","3938","3895","6","0","0"],
    ["C3_CASABUTIK_RT_CAT_PERFORMANCE","06/01/2026","6906.7300","612","350","10","0","0"],
    ["C3_CASABUTIK_RT_CAT_PERFORMANCE","06/02/2026","5147.4100","489","312","13","1","355500"],
    ["C3_CASABUTIK_RT_CAT_PERFORMANCE","06/03/2026","977.3600","74","60","0","0","0"],
    ["C2_TRENTO_PR_INT_ORG_AWARENESS","06/01/2026","3893.7900","2799","2582","24","0","0"],
    ["C2_TRENTO_PR_INT_ORG_AWARENESS","06/02/2026","4414.2700","3345","3050","18","0","0"],
    ["C2_TRENTO_PR_INT_ORG_AWARENESS","06/03/2026","738.1900","505","484","4","0","0"],
    ["C2_DIANA_PR_PERFORMANCE_ADS_SCALE","06/01/2026","4325.3900","2405","1784","45","0","0"],
    ["C2_DIANA_PR_PERFORMANCE_ADS_SCALE","06/02/2026","10668.1900","6202","4378","96","1","521000"],
    ["C2_DIANA_PR_PERFORMANCE_ADS_SCALE","06/03/2026","2767.4700","1194","943","15","0","0"],
    ["C8_CASABUTIK_LEADS_MAYORISTA_WEB_AWARENESS","06/01/2026","7715.7000","1228","958","31","0","0"],
    ["C8_CASABUTIK_LEADS_MAYORISTA_WEB_AWARENESS","06/02/2026","7558.6700","1452","1001","25","0","0"],
    ["C8_CASABUTIK_LEADS_MAYORISTA_WEB_AWARENESS","06/03/2026","2374.5600","375","328","13","0","0"],
    ["C4_DIANA_PRTOP_VT_PERFORMANCE_SHILB","06/01/2026","24882.1600","12043","6839","112","2","877000"],
    ["C4_DIANA_PRTOP_VT_PERFORMANCE_SHILB","06/02/2026","24146.9100","8602","4335","79","0","0"],
    ["C4_DIANA_PRTOP_VT_PERFORMANCE_SHILB","06/03/2026","4752.8100","1948","1301","14","0","0"],
    ["C4_DIANA_PR_EST_ATC_AWARENESS","06/01/2026","5756.0700","3656","3110","120","0","0"],
    ["C4_DIANA_PR_EST_ATC_AWARENESS","06/02/2026","3575.9100","2965","2637","76","0","0"],
    ["C4_DIANA_PR_EST_ATC_AWARENESS","06/03/2026","1593.3300","685","628","21","0","0"],
    ["C1_TRENTO_PR_TRF_AWARENESS_FOLLOWME","06/01/2026","11727.6000","10202","9930","180","0","0"],
    ["C1_TRENTO_PR_TRF_AWARENESS_FOLLOWME","06/02/2026","8686.8100","5384","5107","165","0","0"],
    ["C1_TRENTO_PR_TRF_AWARENESS_FOLLOWME","06/03/2026","2773.6000","1561","1528","55","0","0"],
]

# ── META OTHER (Infoauto + GrupoMF) ──────────────────────────────────────
meta_other = [
    ["INFOAUTO_AB_PRTOP_COM_TN_REVISTA","06/01/2026","0","0","0","0","1","16500"],
    ["C1_TR_GRUPOMF_WEB","06/01/2026","6397.0500","5569","5391","536","0","0"],
    ["C1_TR_GRUPOMF_WEB","06/02/2026","4561.4100","3221","3194","269","0","0"],
    ["C1_TR_GRUPOMF_WEB","06/03/2026","1941.9300","1622","1599","128","0","0"],
    ["C2_LEADS_GRUPOMF_WPP","06/01/2026","22344.4200","8008","6532","27","0","0"],
    ["C2_LEADS_GRUPOMF_WPP","06/02/2026","27439.6600","6070","5178","34","0","0"],
    ["C2_LEADS_GRUPOMF_WPP","06/03/2026","8693.4100","2657","2467","11","0","0"],
]

# ── GOOGLE ADS ────────────────────────────────────────────────────────────
google_data = [
    ["P.Max_SPINIT_PERFORMANCE","06/02/2026","0.8098","5","0","0","0"],
    ["AB_Youtube_VideosTécnicos_SPINIT_PERFORMANCE","06/02/2026","0.5460","2","0","0","0"],
]

# Process Meta Baraldo
for row in meta_baraldo:
    campaign, raw_date, spend, impressions, reach, clicks, purchases, pvalue = row
    client = classify(campaign)
    if not client: continue
    date = parse_date(raw_date)
    key = (client, date, "meta")
    perf[key]["spend"] += float(spend)
    perf[key]["impressions"] += int(float(impressions))
    perf[key]["clicks"] += int(float(clicks))
    perf[key]["reach"] += int(float(reach))
    perf[key]["purchases"] += int(float(purchases))
    perf[key]["revenue"] += float(pvalue)

# Process Meta Other
for row in meta_other:
    campaign, raw_date, spend, impressions, reach, clicks, purchases, pvalue = row
    client = classify(campaign)
    if not client: continue
    date = parse_date(raw_date)
    key = (client, date, "meta")
    perf[key]["spend"] += float(spend)
    perf[key]["impressions"] += int(float(impressions))
    perf[key]["clicks"] += int(float(clicks))
    perf[key]["reach"] += int(float(reach))
    perf[key]["purchases"] += int(float(purchases))
    perf[key]["revenue"] += float(pvalue)

# Process Google
for row in google_data:
    campaign, raw_date, spend, impressions, clicks, conversions, conv_value = row
    client = classify(campaign)
    if not client: continue
    date = parse_date(raw_date)
    key = (client, date, "google_ads")
    perf[key]["spend"] += float(spend)
    perf[key]["impressions"] += int(float(impressions))
    perf[key]["clicks"] += int(float(clicks))
    perf[key]["purchases"] += round(float(conversions))
    perf[key]["revenue"] += float(conv_value)

# ── GENERATE SQL ──────────────────────────────────────────────────────────
print("-- Performance Daily - June 2026 (days 1-3)")
print("-- Generated from MasterMetrics API data")
print()

values = []
for (client, date, provider), m in sorted(perf.items()):
    client_id = CLIENTS[client]
    account_id = ACCOUNTS.get((client, provider), "")
    if not account_id:
        continue
    values.append(
        f"('{WORKSPACE}','{client_id}','{account_id}','{date}','{provider}','platform_total',"
        f"{m['spend']:.2f},{m['impressions']},{m['clicks']},{m['reach']},{m['purchases']},{m['revenue']:.2f},'ARS')"
    )

print("INSERT INTO performance_daily (workspace_id,client_id,account_id,date,provider,entity_type,spend,impressions,clicks,reach,purchases,revenue,currency)")
print("VALUES")
print(",\n".join(values))
print()
print("ON CONFLICT (workspace_id, client_id, date, provider, entity_type)")
print("DO UPDATE SET spend=EXCLUDED.spend, impressions=EXCLUDED.impressions, clicks=EXCLUDED.clicks, reach=EXCLUDED.reach, purchases=EXCLUDED.purchases, revenue=EXCLUDED.revenue;")
print()

# Summary
print("-- Summary:")
totals = defaultdict(lambda: {"spend":0,"purchases":0,"revenue":0})
for (client, date, provider), m in perf.items():
    totals[client]["spend"] += m["spend"]
    totals[client]["purchases"] += m["purchases"]
    totals[client]["revenue"] += m["revenue"]

for client, t in sorted(totals.items()):
    roas = t["revenue"] / t["spend"] if t["spend"] > 0 else 0
    print(f"-- {client}: spend=${t['spend']:,.0f} | purchases={t['purchases']} | revenue=${t['revenue']:,.0f} | ROAS={roas:.1f}x")
