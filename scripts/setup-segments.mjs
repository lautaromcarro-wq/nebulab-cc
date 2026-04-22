import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const EMAIL = 'lcarro@abstractsolutions.com.ar';
const PASS = '***REMOVED***';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('Autenticando...');
  const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
    email: EMAIL,
    password: PASS,
  });

  if (authErr) {
    console.error('Error de Auth:', authErr.message);
    process.exit(1);
  }
  console.log(`✓ Autenticado como: ${authData.user.email}`);

  // 1. Obtener/Crear Workspace
  let { data: workspaces } = await sb.from('workspaces').select('id, name').limit(1);
  if (!workspaces || workspaces.length === 0) {
    console.log('No hay workspaces, no se pueden crear clientes.');
    process.exit(1);
  }
  const workspaceId = workspaces[0].id;
  console.log(`Usando Workspace: ${workspaces[0].name}`);

  // 2. Obtener Clientes o Crear (Angel Baraldo, InfoAuto)
  let { data: clients } = await sb.from('clients').select('id, name');
  let baraldo = clients?.find(c => c.name.toLowerCase().includes('baraldo'));
  let infoauto = clients?.find(c => c.name.toLowerCase().includes('infoauto'));

  if (!baraldo) {
    console.log('Creando cliente: Angel Baraldo...');
    const res = await sb.from('clients').insert({ name: 'Angel Baraldo', workspace_id: workspaceId, status: 'active' }).select('id');
    if (res.error) throw res.error;
    baraldo = res.data[0];
  }
  if (!infoauto) {
    console.log('Creando cliente: InfoAuto...');
    const res = await sb.from('clients').insert({ name: 'InfoAuto', workspace_id: workspaceId, status: 'active' }).select('id');
    if (res.error) throw res.error;
    infoauto = res.data[0];
  }

  const clientsMap = {
    [baraldo.id]: {
      name: 'Angel Baraldo',
      brands: ['CASABUTIK', 'DIANA', 'SPINIT', 'TRENTO', 'SHILBA']
    },
    [infoauto.id]: {
      name: 'InfoAuto',
      brands: ['INFOAUTO', 'NEXO']
    }
  };

  // 3. Crear Segmentos y Reglas
  for (const clientId of Object.keys(clientsMap)) {
    const { name, brands } = clientsMap[clientId];
    console.log(`\nProcesando segmentos para ${name}...`);

    for (const brand of brands) {
      console.log(`  Creando segmento y regla: ${brand}`);
      
      // Intentar crear segmento
      let segmentId;
      const { data: segmentData, error: segErr } = await sb.from('segments').insert({
        workspace_id: workspaceId,
        client_id: clientId,
        name: brand,
        currency: 'ARS',
        monthly_budget: 0,
        rolling_avg_days: 30,
        status: 'active',
        tolerance_percent: 0.15
      }).select('id').single();

      if (segErr) {
        if (segErr.code === '23505') { // unique violation
           const { data: existing } = await sb.from('segments').select('id').eq('workspace_id', workspaceId).eq('name', brand).single();
           if (existing) {
             console.log(`    Segmento ya existía, usando id: ${existing.id}`);
             segmentId = existing.id;
           } else {
             console.error(`    x Error obteniendo segmento existente ${brand}`);
             continue;
           }
        } else {
          console.error(`    x Error creando segmento ${brand}:`, segErr.message);
          continue;
        }
      } else {
        segmentId = segmentData.id;
      }

      // Crear regla: campaign_name contains "MARCA"
      const { error: ruleErr } = await sb.from('segment_rules').insert({
        segment_id: segmentId,
        workspace_id: workspaceId,
        client_id: clientId,
        rule_type: 'contains',
        rule_value: brand,
        platform: 'any',
        entity_level: 'campaign',
        is_inclusive: true,
        priority: 0
      });

      if (ruleErr) {
        console.error(`    x Error creando regla para ${brand}:`, ruleErr.message);
      } else {
        console.log(`    ✓ Completado: ${brand}`);
      }
    }
  }

  console.log('\n¡Todos los segmentos fueron creados exitosamente!');
}

main().catch(console.error);
