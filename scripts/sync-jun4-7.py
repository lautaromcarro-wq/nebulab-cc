#!/usr/bin/env python3
"""Process MasterMetrics June 4-7 data and generate SQL + weekly summary."""
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
    if "INFOAUTO" in c or "NEXO" in c or "EMPRESAS" in c: return "Infoauto"
    if "GRUPOMF" in c: return "GrupoMF"
    return None

def parse_date(d):
    if "/" in d:
        mm, dd, yyyy = d.split("/")
        return f"{yyyy}-{mm.zfill(2)}-{dd.zfill(2)}"
    return d

perf = defaultdict(lambda: {"spend":0,"impressions":0,"clicks":0,"reach":0,"purchases":0,"revenue":0})

# ── META BARALDO (account 508337272928554) ─────────────────────────────
meta_baraldo = [
    ["C3_DIANA_RT_CAT_PERFORMANCE","06/04/2026","15256.1500","8027","4215","127","1","477900"],
    ["C3_DIANA_RT_CAT_PERFORMANCE","06/05/2026","16289.1600","8703","4735","105","1","672000"],
    ["C3_DIANA_RT_CAT_PERFORMANCE","06/06/2026","16105.0600","7992","4298","90","1","271800"],
    ["C3_DIANA_RT_CAT_PERFORMANCE","06/07/2026","18344.3000","8168","4336","142","1","262050.2700"],
    ["C5_DIANA_PR_INT_ORG_AWARENESS","06/04/2026","5467.6100","9490","9367","131","0","0"],
    ["C5_DIANA_PR_INT_ORG_AWARENESS","06/05/2026","5543","8809","8489","125","0","0"],
    ["C5_DIANA_PR_INT_ORG_AWARENESS","06/06/2026","6612.6800","7135","7135","79","0","0"],
    ["C5_DIANA_PR_INT_ORG_AWARENESS","06/07/2026","7402.4200","11432","11003","169","0","0"],
    ["C1_SPINIT_PR_PERFORMANCE_SCALE","06/04/2026","20590.3500","9670","5105","229","1","135272.0600"],
    ["C1_SPINIT_PR_PERFORMANCE_SCALE","06/05/2026","20825.1900","10103","5592","292","0","0"],
    ["C1_SPINIT_PR_PERFORMANCE_SCALE","06/06/2026","21394.2300","9555","5983","274","0","0"],
    ["C1_SPINIT_PR_PERFORMANCE_SCALE","06/07/2026","22389.9700","9476","6072","299","1","73096.0300"],
    ["C6_SPINIT_PR_INT_ORG_AWARENESS","06/04/2026","5212.9000","10641","10110","204","0","0"],
    ["C6_SPINIT_PR_INT_ORG_AWARENESS","06/05/2026","2034.2200","4092","3995","62","0","0"],
    ["C6_SPINIT_PR_INT_ORG_AWARENESS","06/06/2026","8424.6400","4969","4430","166","0","0"],
    ["C6_SPINIT_PR_INT_ORG_AWARENESS","06/07/2026","6379.2400","4805","4223","219","0","0"],
    ["C5_SPINIT_INT_VC_AWARENESS","06/04/2026","19622.2300","17111","13293","713","0","0"],
    ["C5_SPINIT_INT_VC_AWARENESS","06/05/2026","18532.6700","15237","12162","565","0","0"],
    ["C5_SPINIT_INT_VC_AWARENESS","06/06/2026","23904.8600","16639","13126","561","1","53076.0300"],
    ["C5_SPINIT_INT_VC_AWARENESS","06/07/2026","25626.7400","19739","15482","813","2","418519.9200"],
    ["C5_CASABUTIK_PR_VC_AWARENESS","06/04/2026","1246.6300","735","735","43","0","0"],
    ["C5_CASABUTIK_PR_VC_AWARENESS","06/05/2026","1308.1500","847","809","48","0","0"],
    ["C5_CASABUTIK_PR_VC_AWARENESS","06/06/2026","729.5200","434","434","22","0","0"],
    ["C5_CASABUTIK_PR_VC_AWARENESS","06/07/2026","5996.5900","4050","3944","206","0","0"],
    ["C2_CASABUTIK_PR_PERFORMANCE_SCALE","06/04/2026","51377.8100","5026","2691","111","4","1207082.1200"],
    ["C2_CASABUTIK_PR_PERFORMANCE_SCALE","06/05/2026","38214.6300","4122","2342","68","6","1112658.4200"],
    ["C2_CASABUTIK_PR_PERFORMANCE_SCALE","06/06/2026","37599.4800","4298","2601","93","3","695839.9200"],
    ["C2_CASABUTIK_PR_PERFORMANCE_SCALE","06/07/2026","58382.4600","7066","3961","138","5","1044830.2600"],
    ["C4_CASABUTIK_PR_EST_ATC_AWARENESS","06/04/2026","5133.2800","940","838","64","0","0"],
    ["C4_CASABUTIK_PR_EST_ATC_AWARENESS","06/05/2026","7599.8400","1382","1269","119","0","0"],
    ["C4_CASABUTIK_PR_EST_ATC_AWARENESS","06/06/2026","5516.2000","1065","992","84","0","0"],
    ["C4_CASABUTIK_PR_EST_ATC_AWARENESS","06/07/2026","6833.4700","1216","1110","113","0","0"],
    ["C6_CASABUTIK_INT_ORG_AWARENESS","06/04/2026","7125.4100","10186","9678","50","0","0"],
    ["C6_CASABUTIK_INT_ORG_AWARENESS","06/05/2026","5303.2600","6487","6142","48","0","0"],
    ["C6_CASABUTIK_INT_ORG_AWARENESS","06/06/2026","6628.0100","5393","5129","37","0","0"],
    ["C6_CASABUTIK_INT_ORG_AWARENESS","06/07/2026","7565.7700","8739","8686","51","0","0"],
    ["C3_CASABUTIK_RT_CAT_PERFORMANCE","06/04/2026","4485.7300","322","196","9","0","0"],
    ["C3_CASABUTIK_RT_CAT_PERFORMANCE","06/05/2026","3592.6900","394","252","3","0","0"],
    ["C3_CASABUTIK_RT_CAT_PERFORMANCE","06/06/2026","2980.8300","311","214","12","0","0"],
    ["C3_CASABUTIK_RT_CAT_PERFORMANCE","06/07/2026","6443.2300","509","298","24","1","1111500"],
    ["C2_TRENTO_PR_INT_ORG_AWARENESS","06/04/2026","4199.0900","3014","2737","181","0","0"],
    ["C2_TRENTO_PR_INT_ORG_AWARENESS","06/05/2026","3775.9800","2245","1991","122","0","0"],
    ["C2_TRENTO_PR_INT_ORG_AWARENESS","06/06/2026","4244.9700","3294","3122","161","0","0"],
    ["C2_TRENTO_PR_INT_ORG_AWARENESS","06/07/2026","4389.0300","3231","2954","193","0","0"],
    ["C2_DIANA_PR_PERFORMANCE_ADS_SCALE","06/04/2026","9803.8500","6202","4666","144","1","604800"],
    ["C2_DIANA_PR_PERFORMANCE_ADS_SCALE","06/05/2026","9548.2400","5199","3774","76","0","0"],
    ["C2_DIANA_PR_PERFORMANCE_ADS_SCALE","06/06/2026","11904.0700","6030","4471","81","0","0"],
    ["C2_DIANA_PR_PERFORMANCE_ADS_SCALE","06/07/2026","12978.2700","6835","5198","137","0","0"],
    ["C8_CASABUTIK_LEADS_MAYORISTA_WEB_AWARENESS","06/04/2026","6609.0800","1429","1064","63","0","0"],
    ["C8_CASABUTIK_LEADS_MAYORISTA_WEB_AWARENESS","06/05/2026","6615.4000","1097","879","56","0","0"],
    ["C8_CASABUTIK_LEADS_MAYORISTA_WEB_AWARENESS","06/06/2026","6903.8800","1146","895","52","0","0"],
    ["C8_CASABUTIK_LEADS_MAYORISTA_WEB_AWARENESS","06/07/2026","7884.3000","1321","1044","69","0","0"],
    ["C4_DIANA_PRTOP_VT_PERFORMANCE_SHILB","06/04/2026","26347.0700","11578","6819","167","0","0"],
    ["C4_DIANA_PRTOP_VT_PERFORMANCE_SHILB","06/05/2026","24870.1400","10009","5712","127","0","0"],
    ["C4_DIANA_PRTOP_VT_PERFORMANCE_SHILB","06/06/2026","22829.9000","8379","5200","127","0","0"],
    ["C4_DIANA_PRTOP_VT_PERFORMANCE_SHILB","06/07/2026","27188.0900","9631","5030","144","0","0"],
    ["C4_DIANA_PR_EST_ATC_AWARENESS","06/04/2026","5815.5000","4751","3973","194","0","0"],
    ["C4_DIANA_PR_EST_ATC_AWARENESS","06/05/2026","6579.0700","5271","4590","240","0","0"],
    ["C4_DIANA_PR_EST_ATC_AWARENESS","06/06/2026","7547.8200","4288","3847","168","0","0"],
    ["C4_DIANA_PR_EST_ATC_AWARENESS","06/07/2026","6358.8800","3423","2978","163","0","0"],
    ["C1_TRENTO_PR_TRF_AWARENESS_FOLLOWME","06/04/2026","7899.8300","5560","5274","141","0","0"],
    ["C1_TRENTO_PR_TRF_AWARENESS_FOLLOWME","06/05/2026","8769.9800","5035","4930","150","0","0"],
    ["C1_TRENTO_PR_TRF_AWARENESS_FOLLOWME","06/06/2026","9987.2900","6263","6040","210","0","0"],
    ["C1_TRENTO_PR_TRF_AWARENESS_FOLLOWME","06/07/2026","9358.8100","5868","5772","237","0","0"],
]

# ── META OTHER (GrupoMF + others) ──────────────────────────────────────
meta_other = [
    ["C1_TR_GRUPOMF_WEB","06/04/2026","5932.5800","4970","4635","725","0","0"],
    ["C1_TR_GRUPOMF_WEB","06/05/2026","5507.1300","3996","3936","713","0","0"],
    ["C1_TR_GRUPOMF_WEB","06/06/2026","5178.7500","3623","3594","595","0","0"],
    ["C1_TR_GRUPOMF_WEB","06/07/2026","7259.3400","5437","5381","802","0","0"],
    ["C2_LEADS_GRUPOMF_WPP","06/04/2026","15969.9700","5208","4809","109","0","0"],
    ["C2_LEADS_GRUPOMF_WPP","06/05/2026","16732.5000","5941","5275","119","0","0"],
    ["C2_LEADS_GRUPOMF_WPP","06/06/2026","10858.1200","3703","3378","58","0","0"],
    ["C2_LEADS_GRUPOMF_WPP","06/07/2026","17659.6700","6020","5316","136","0","0"],
]

# ── GOOGLE ADS ─────────────────────────────────────────────────────────
# Format: campaign, date, spend, impressions, clicks, conversions, conv_value
google_data = [
    # Infoauto
    ["INFOAUTO_Aniversario_YOUTUBE","06/04/2026","20264.5402","4320","0","0","0"],
    ["INFOAUTO_Aniversario_YOUTUBE","06/05/2026","20020.2648","28096","0","0","0"],
    ["INFOAUTO_Aniversario_YOUTUBE","06/06/2026","20251.9865","30249","0","0","0"],
    ["INFOAUTO_Aniversario_YOUTUBE","06/07/2026","13672.9596","18521","0","0","0"],
    ["01_AB_General & Brand_NEXO [SEARCH]","06/04/2026","12473.7912","296","19","2","2"],
    ["01_AB_General & Brand_NEXO [SEARCH]","06/05/2026","15979.6574","424","12","4","4"],
    ["01_AB_General & Brand_NEXO [SEARCH]","06/06/2026","8636.5568","293","11","1","1"],
    ["01_AB_General & Brand_NEXO [SEARCH]","06/07/2026","15998.2142","201","19","2","2"],
    ["01_B_AB_INFOAUTO_Competidores [SEARCH]","06/04/2026","458.0957","142","3","1","0"],
    ["01_B_AB_INFOAUTO_Competidores [SEARCH]","06/05/2026","1320.6995","279","11","5","0"],
    ["01_B_AB_INFOAUTO_Competidores [SEARCH]","06/06/2026","1642.4143","437","9","1","0"],
    ["01_B_AB_INFOAUTO_Competidores [SEARCH]","06/07/2026","2169.9533","201","5","1","0"],
    ["01_A_AB.INFOAUTO_Branding [SEARCH]","06/04/2026","1687.8249","524","330","166.6771","2.0101"],
    ["01_A_AB.INFOAUTO_Branding [SEARCH]","06/05/2026","4354.8518","1456","870","377.5222","5.0244"],
    ["01_A_AB.INFOAUTO_Branding [SEARCH]","06/06/2026","3199.9210","906","564","201.4512","2"],
    ["01_A_AB.INFOAUTO_Branding [SEARCH]","06/07/2026","5166.7038","856","513","191.8333","3"],
    ["03.AB.Particulares y profesionales[SEARCH]","06/04/2026","3239.9808","871","37","5.7934","0"],
    ["03.AB.Particulares y profesionales[SEARCH]","06/05/2026","12189.4016","1583","67","24.8340","0"],
    ["03.AB.Particulares y profesionales[SEARCH]","06/06/2026","2029.7570","838","30","4","0"],
    ["03.AB.Particulares y profesionales[SEARCH]","06/07/2026","14006.7306","2872","65","7.9463","0"],
    ["02.AB.INFOAUTO.General [No-Branded] [SEARCH]","06/04/2026","2871.0443","873","93","26.0202","0"],
    ["02.AB.INFOAUTO.General [No-Branded] [SEARCH]","06/05/2026","5693.0789","1700","200","78.5249","1"],
    ["02.AB.INFOAUTO.General [No-Branded] [SEARCH]","06/06/2026","7724.0101","2038","249","60.5917","1"],
    ["02.AB.INFOAUTO.General [No-Branded] [SEARCH]","06/07/2026","17000.4006","4114","352","91.7293","0"],
    ["05.AB.Empresas [SEARCH]","06/05/2026","50.5500","7","1","0","0"],
    ["05.AB.Empresas [SEARCH]","06/06/2026","299.4165","10","5","0","0"],
    ["05.AB.Empresas [SEARCH]","06/07/2026","275.7497","9","2","1","0"],
    # Casabutik Google
    ["AB_YOUTUBE_INT_AWARENESS_CASABUTIK","06/04/2026","10906.1963","6954","30","30","30"],
    ["AB_YOUTUBE_INT_AWARENESS_CASABUTIK","06/05/2026","11213.7022","10062","113","112","112"],
    ["AB_YOUTUBE_INT_AWARENESS_CASABUTIK","06/06/2026","11301.2156","16390","148","140","140"],
    ["AB_YOUTUBE_INT_AWARENESS_CASABUTIK","06/07/2026","11275.4893","18634","140","112","112"],
    ["AB_Search_GENERICOS_HIGH_INTENT_CASABUTIK_AWARENESS","06/04/2026","5986.6916","341","18","0","0"],
    ["AB_Search_GENERICOS_HIGH_INTENT_CASABUTIK_AWARENESS","06/05/2026","9994.2815","599","20","0","0"],
    ["AB_Search_GENERICOS_HIGH_INTENT_CASABUTIK_AWARENESS","06/06/2026","9450.9812","526","13","0","0"],
    ["AB_Search_GENERICOS_HIGH_INTENT_CASABUTIK_AWARENESS","06/07/2026","5842.8959","344","9","0","0"],
    ["AB_PMAX_CASABUTIK_AWARENESS","06/04/2026","20027.3562","2802","56","1","265000"],
    ["AB_PMAX_CASABUTIK_AWARENESS","06/05/2026","19927.4289","2306","71","0","0"],
    ["AB_PMAX_CASABUTIK_AWARENESS","06/06/2026","11663.3296","854","49","2","479700"],
    ["AB_PMAX_CASABUTIK_AWARENESS","06/07/2026","8584.0694","935","40","1","291000"],
    ["AB_YOUTUBE_BRANDING_CASABUTIK_AWARENESS","06/04/2026","4742.8112","3887","124","0","0"],
    ["AB_Search_BRANDING_CASABUTIK_AWARENESS","06/04/2026","856.6522","48","4","0","0"],
    ["AB_Search_BRANDING_CASABUTIK_AWARENESS","06/05/2026","2999.1876","86","9","0","0"],
    ["AB_Search_BRANDING_CASABUTIK_AWARENESS","06/06/2026","13718.5870","1052","31","0","0"],
    ["AB_Search_BRANDING_CASABUTIK_AWARENESS","06/07/2026","13998.8969","844","22","0","0"],
    # Spinit Google
    ["Spinit_Search_Branded_PERFORMANCE","06/04/2026","0.0958","2","1","0","0"],
    ["Spinit_Search_Branded_PERFORMANCE","06/05/2026","0","2","0","0","0"],
    ["P.Max_SPINIT_PERFORMANCE","06/04/2026","72.1898","37","1","0","0"],
    ["P.Max_SPINIT_PERFORMANCE","06/05/2026","24.4178","20","0","0","0"],
    ["P.Max_SPINIT_PERFORMANCE","06/06/2026","50.9852","108","7","0","0"],
    ["P.Max_SPINIT_PERFORMANCE","06/07/2026","1015.7193","633","52","0","0"],
    ["AB_Youtube_VideosTécnicos_SPINIT_PERFORMANCE","06/04/2026","2.4985","7","0","0","0"],
    ["AB_Youtube_VideosTécnicos_SPINIT_PERFORMANCE","06/05/2026","3.9164","5","0","0","0"],
    ["AB_Youtube_VideosTécnicos_SPINIT_PERFORMANCE","06/06/2026","14.0274","22","1","0","0"],
    ["AB_Youtube_VideosTécnicos_SPINIT_PERFORMANCE","06/07/2026","231.6381","211","1","0","0"],
    ["Spinit_Search_HighIntent_PERFORMANCE","06/07/2026","0","2","0","0","0"],
    # Diana Google
    ["Diana_Search_HighIntent_PERFORMANCE","06/04/2026","24150.3557","2484","116","0","0"],
    ["Diana_Search_HighIntent_PERFORMANCE","06/05/2026","33990.7539","3421","126","1","347000"],
    ["Diana_Search_HighIntent_PERFORMANCE","06/06/2026","29949.9032","2349","122","0","0"],
    ["Diana_Search_HighIntent_PERFORMANCE","06/07/2026","18299.2083","1352","88","0","0"],
    ["AB_YOUTUBE_INT_DIANA_AWARENESS","06/04/2026","11770.6767","5463","61","0","0"],
    ["AB_YOUTUBE_INT_DIANA_AWARENESS","06/05/2026","11664.3458","4406","27","0","0"],
    ["AB_YOUTUBE_INT_DIANA_AWARENESS","06/06/2026","7114.5791","2997","19","0","0"],
    ["AB_YOUTUBE_INT_DIANA_AWARENESS","06/07/2026","6162.3149","3239","24","0","0"],
    ["AB_SEARCH_DIANA_NoBranded_KwsGenerales_AWARENESS","06/04/2026","929.9182","487","9","0","0"],
    ["AB_SEARCH_DIANA_NoBranded_KwsGenerales_AWARENESS","06/05/2026","4453.9476","820","27","0","0"],
    ["AB_SEARCH_DIANA_NoBranded_KwsGenerales_AWARENESS","06/06/2026","9262.0750","1390","33","0","0"],
    ["AB_SEARCH_DIANA_NoBranded_KwsGenerales_AWARENESS","06/07/2026","6268.5040","1151","24","0","0"],
    ["P.max_Camping_DIANA_PERFORMANCE","06/04/2026","9567.6984","4199","67","0","0"],
    ["P.max_Camping_DIANA_PERFORMANCE","06/05/2026","8075.3549","2536","44","0","0"],
    ["P.max_Camping_DIANA_PERFORMANCE","06/06/2026","6136.4235","2842","41","0","0"],
    ["P.max_Camping_DIANA_PERFORMANCE","06/07/2026","8489.3321","2158","41","0","0"],
]

def classify_google(campaign):
    c = campaign.upper()
    if "CASABUTIK" in c: return "Casabutik"
    if "DIANA" in c: return "Diana"
    if "SPINIT" in c: return "Spinit"
    if "TRENTO" in c: return "Trento"
    if "INFOAUTO" in c or "NEXO" in c or "EMPRESAS" in c or "PARTICULARES" in c: return "Infoauto"
    if "GRUPOMF" in c: return "GrupoMF"
    return None

def is_real_purchase(campaign, conversions, conv_value):
    """Filter: only count as purchases if avg value > 10000 ARS (real ecommerce)
    YouTube views, search leads, etc. have value ≈ 0 or value ≈ count"""
    if float(conversions) == 0: return (0, 0)
    avg = float(conv_value) / float(conversions) if float(conversions) > 0 else 0
    if avg > 10000:  # Real ecommerce purchase
        return (round(float(conversions)), float(conv_value))
    return (0, 0)  # Engagement/leads, not purchases

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

# Process Google (only count real ecommerce purchases, not leads/engagement)
for row in google_data:
    campaign, raw_date, spend, impressions, clicks, conversions, conv_value = row
    client = classify_google(campaign)
    if not client: continue
    date = parse_date(raw_date)
    key = (client, date, "google_ads")
    perf[key]["spend"] += float(spend)
    perf[key]["impressions"] += int(float(impressions))
    perf[key]["clicks"] += int(float(clicks))
    real_purchases, real_value = is_real_purchase(campaign, conversions, conv_value)
    perf[key]["purchases"] += real_purchases
    perf[key]["revenue"] += real_value

# ── GENERATE SQL ──────────────────────────────────────────────────────
import sys

f = open("/Users/lautcro/Proyectos/nebulab-command-center/scripts/seed-jun4-7.sql", "w")

f.write("-- Performance Daily - June 4-7, 2026\n")
f.write("-- Generated from MasterMetrics data\n\n")

values = []
for (client, date, provider), m in sorted(perf.items()):
    client_id = CLIENTS.get(client)
    account_id = ACCOUNTS.get((client, provider))
    if not client_id or not account_id:
        continue
    values.append(
        f"('{WORKSPACE}','{client_id}','{account_id}','{date}','{provider}','platform_total',"
        f"{m['spend']:.2f},{m['impressions']},{m['clicks']},{m['reach']},{m['purchases']},{m['revenue']:.2f},'ARS')"
    )

f.write("DELETE FROM performance_daily WHERE workspace_id = '{}' AND date BETWEEN '2026-06-04' AND '2026-06-07';\n\n".format(WORKSPACE))
f.write("INSERT INTO performance_daily (workspace_id,client_id,account_id,date,provider,entity_type,spend,impressions,clicks,reach,purchases,revenue,currency)\nVALUES\n")
f.write(",\n".join(values))
f.write(";\n")
f.close()

print(f"SQL generated: {len(values)} rows")
print()

# ── WEEKLY SUMMARY (Jun 1-7) ──────────────────────────────────────────
# Include Jun 1-3 data from existing DB (hardcoded from previous sync)
jun1_3 = {
    ("Diana","meta"): {"spend":124268.05,"impressions":80173,"clicks":28300,"purchases":4,"revenue":3804486.03},
    ("Spinit","meta"): {"spend":100998.57,"impressions":52343+40197+12974,"clicks":34125+10873+3413,"purchases":1,"revenue":171080},
    ("Spinit","google_ads"): {"spend":1.36,"impressions":7,"clicks":0,"purchases":0,"revenue":0},
    ("Casabutik","meta"): {"spend":84884.64+74790.74+23541.36,"impressions":22752+17035+8386,"clicks":231+238+64,"purchases":3+2+0,"revenue":1643386.03+581500+0},
    ("Trento","meta"): {"spend":15621.39+13101.08+3511.79,"impressions":13001+8729+2066,"clicks":9930+5107+1528,"purchases":0,"revenue":0},
    ("Infoauto","meta"): {"spend":0,"impressions":0,"clicks":0,"purchases":1,"revenue":16500},
    ("GrupoMF","meta"): {"spend":28741.47+32001.07+10635.34,"impressions":13577+9291+4279,"clicks":5391+3194+1599,"purchases":0,"revenue":0},
}

# Aggregate Jun 4-7
jun4_7 = defaultdict(lambda: {"spend":0,"impressions":0,"clicks":0,"purchases":0,"revenue":0})
for (client, date, provider), m in perf.items():
    key = (client, provider)
    jun4_7[key]["spend"] += m["spend"]
    jun4_7[key]["impressions"] += m["impressions"]
    jun4_7[key]["clicks"] += m["clicks"]
    jun4_7[key]["purchases"] += m["purchases"]
    jun4_7[key]["revenue"] += m["revenue"]

# Combine for full week
full_week = defaultdict(lambda: {"spend":0,"impressions":0,"clicks":0,"purchases":0,"revenue":0})
for (client, provider), m in jun1_3.items():
    full_week[client]["spend"] += m["spend"]
    full_week[client]["impressions"] += m["impressions"]
    full_week[client]["clicks"] += m["clicks"]
    full_week[client]["purchases"] += m["purchases"]
    full_week[client]["revenue"] += m["revenue"]

for (client, provider), m in jun4_7.items():
    full_week[client]["spend"] += m["spend"]
    full_week[client]["impressions"] += m["impressions"]
    full_week[client]["clicks"] += m["clicks"]
    full_week[client]["purchases"] += m["purchases"]
    full_week[client]["revenue"] += m["revenue"]

# Budgets (gross) and fee
FEE = 0.30
BUDGETS = {
    "Diana": 1780321 + 600000,
    "Spinit": 700000 + 1050000,
    "Casabutik": 2079692 + 1100000,
    "Trento": 0 + 350000,
    "Infoauto": 0,
    "GrupoMF": 0,
}

print("=" * 80)
print("NEBULAB — STATUS SEMANAL: 1-7 Junio 2026")
print("=" * 80)
print()

total_spend = 0
total_revenue = 0
total_purchases = 0

for client in ["Diana", "Spinit", "Casabutik", "Trento", "Infoauto", "GrupoMF"]:
    m = full_week[client]
    budget_gross = BUDGETS.get(client, 0)
    budget_net = budget_gross / (1 + FEE) if budget_gross > 0 else 0
    pacing = (m["spend"] / budget_net * 100) if budget_net > 0 else 0
    expected = (7 / 30) * 100  # 23.3%
    roas = m["revenue"] / m["spend"] if m["spend"] > 0 else 0
    cpa = m["spend"] / m["purchases"] if m["purchases"] > 0 else 0
    ctr = (m["clicks"] / m["impressions"] * 100) if m["impressions"] > 0 else 0

    total_spend += m["spend"]
    total_revenue += m["revenue"]
    total_purchases += m["purchases"]

    print(f"{'─' * 60}")
    print(f"  {client.upper()}")
    print(f"{'─' * 60}")
    print(f"  Spend:       ${m['spend']:>12,.0f} ARS")
    if budget_net > 0:
        print(f"  Budget NET:  ${budget_net:>12,.0f} ARS")
        print(f"  Pacing:      {pacing:>11.1f}%  (esperado: {expected:.1f}%)")
        delta = pacing - expected
        status = "ON TRACK" if abs(delta) < 5 else ("OVERPACING" if delta > 0 else "UNDERPACING")
        print(f"  Status:      {status} ({'+' if delta > 0 else ''}{delta:.1f}pp)")
    print(f"  Revenue:     ${m['revenue']:>12,.0f} ARS")
    print(f"  Compras:     {m['purchases']:>12}")
    if m["spend"] > 0:
        print(f"  ROAS:        {roas:>11.2f}x")
    if m["purchases"] > 0:
        print(f"  CPA:         ${cpa:>12,.0f} ARS")
    print(f"  Impressions: {m['impressions']:>12,}")
    print(f"  Clicks:      {m['clicks']:>12,}")
    if m["impressions"] > 0:
        print(f"  CTR:         {ctr:>11.2f}%")
    print()

print(f"{'=' * 60}")
print(f"  PORTFOLIO TOTAL")
print(f"{'=' * 60}")
print(f"  Spend Total:     ${total_spend:>12,.0f} ARS")
print(f"  Revenue Total:   ${total_revenue:>12,.0f} ARS")
print(f"  Compras Total:   {total_purchases:>12}")
blended_roas = total_revenue / total_spend if total_spend > 0 else 0
blended_cpa = total_spend / total_purchases if total_purchases > 0 else 0
print(f"  ROAS Blended:    {blended_roas:>11.2f}x")
print(f"  CPA Blended:     ${blended_cpa:>12,.0f} ARS")
print()
