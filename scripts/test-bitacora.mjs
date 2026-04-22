import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const EMAIL = 'lcarro@abstractsolutions.com.ar';
const PASS = '***REMOVED***';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  await sb.auth.signInWithPassword({ email: EMAIL, password: PASS });
  
  const { data: workspaces } = await sb.from('workspaces').select('id').limit(1);
  const workspaceId = workspaces[0].id;
  
  const { data: clients } = await sb.from('clients').select('id, name');
  const baraldo = clients.find(c => c.name.toLowerCase().includes('baraldo'));
  
  if (!baraldo) return console.log('Angel Baraldo no encontrado');

  console.log('Insertando en client_bitacora...');
  const { error } = await sb.from('client_bitacora').insert({
    workspace_id: workspaceId,
    client_id: baraldo.id,
    type: 'nota',
    title: 'Test de Bitácora',
    body: 'Este es un mensaje de prueba para verificar que la bitácora funciona correctamente.',
    author_name: 'Antigravity'
  });
  
  if (error) {
    console.error('Error insertando en client_bitacora:', error);
  } else {
    console.log('✓ Bitácora insertada');
  }

  console.log('Consultando client_bitacora...');
  const { data: entries, error: readErr } = await sb.from('client_bitacora').select('*').eq('client_id', baraldo.id);
  
  if (readErr) {
    console.error('Error leyendo client_bitacora:', readErr);
  } else {
    console.log(`✓ Encontradas ${entries.length} entradas en client_bitacora`);
    console.log(entries);
  }
}

main().catch(console.error);
