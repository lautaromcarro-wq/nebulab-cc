// Script para descubrir clientes y workspace
// Uso: node --env-file=.env check-segments.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const { data: workspaces } = await sb.from('workspaces').select('id, name');
  console.log('\n=== WORKSPACES ===');
  (workspaces || []).forEach(w => console.log(`  ${w.id} → ${w.name}`));

  const { data: clients } = await sb.from('clients').select('id, name, workspace_id');
  console.log('\n=== CLIENTS ===');
  (clients || []).forEach(c => console.log(`  ${c.id} → ${c.name} (ws: ${c.workspace_id})`));

  const baraldo = (clients || []).find(c => c.name.toLowerCase().includes('baraldo'));
  const infoauto = (clients || []).find(c => c.name.toLowerCase().includes('infoauto'));

  console.log('\n=== BÚSQUEDA ===');
  console.log(baraldo ? `✓ Baraldo: ${baraldo.id} (ws: ${baraldo.workspace_id})` : '⚠ "Angel Baraldo" no encontrado');
  console.log(infoauto ? `✓ InfoAuto: ${infoauto.id} (ws: ${infoauto.workspace_id})` : '⚠ "InfoAuto" no encontrado');

  const { data: segments } = await sb.from('segments').select('id, name, client_id');
  console.log('\n=== SEGMENTS EXISTENTES ===');
  (segments || []).forEach(s => console.log(`  ${s.id} → ${s.name} (client: ${s.client_id})`));

  const { data: rules } = await sb.from('segment_rules').select('id, segment_id, rule_type, rule_value');
  console.log('\n=== SEGMENT RULES EXISTENTES ===');
  (rules || []).forEach(r => console.log(`  ${r.id} → seg:${r.segment_id} ${r.rule_type}:"${r.rule_value}"`));
}

main().catch(console.error);
