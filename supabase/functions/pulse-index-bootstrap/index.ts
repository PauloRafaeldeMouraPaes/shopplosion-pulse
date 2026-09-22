import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  return new Response(JSON.stringify({ error: 'disabled' }), {
    status: 410,
    headers: { 'Content-Type': 'application/json' },
  });
});
