// ============================================================
//  Supabase Edge Function: unsubscribe
//  Deploy: supabase functions deploy unsubscribe
//
//  Linked from the unsubscribe URL in send-newsletter's emails:
//  ${SUPABASE_URL}/functions/v1/unsubscribe?email=...
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const page = (title: string, message: string) => `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f5f2eb;font-family:'DM Sans',Arial,sans-serif;">
  <div style="max-width:480px;margin:4rem auto;background:white;border-radius:16px;padding:2.5rem;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="width:48px;height:48px;border-radius:10px;background:linear-gradient(135deg,#c9a227,#a07a1a);display:inline-flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:700;color:#162040;margin-bottom:1.5rem;">AC</div>
    <h1 style="color:#162040;font-size:1.3rem;margin:0 0 0.75rem;">${title}</h1>
    <p style="color:#7a89aa;font-size:0.9rem;margin:0;">${message}</p>
  </div>
</body>
</html>`

serve(async (req) => {
  const url = new URL(req.url)
  const email = url.searchParams.get('email')

  if (!email) {
    return new Response(page('Missing email', 'No email address was provided in this link.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' }
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  const { error } = await supabase
    .from('newsletter_subscribers')
    .update({ subscribed: false })
    .eq('email', email)

  if (error) {
    return new Response(page('Something went wrong', 'We could not process your unsubscribe request. Please try again later.'), {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    })
  }

  return new Response(page('You\'re unsubscribed', `${email} will no longer receive newsletter emails from Ambassadors Club.`), {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  })
})
