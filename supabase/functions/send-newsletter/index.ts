// ============================================================
//  Supabase Edge Function: send-newsletter
//  Deploy: supabase functions deploy send-newsletter
//
//  Triggered manually or via a Supabase webhook when a new
//  event is inserted into the `events` table.
//
//  Uses Resend (free tier: 3,000 emails/month)
//  Sign up at https://resend.com — takes 2 minutes
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY  = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM_EMAIL = 'Ambassadors Club <onboarding@resend.dev>'
const SITE_URL   = Deno.env.get('SITE_URL') || 'https://ambassadors-club.vercel.app'
serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const body = await req.json()
  // body.event = the new event row from the `events` table
  const event = body.event || body.record

  if (!event) return new Response('No event data', { status: 400 })

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  // Get all active subscribers
  const { data: subscribers, error } = await supabase
    .from('newsletter_subscribers')
    .select('email, name')
    .eq('subscribed', true)

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  if (!subscribers?.length) return new Response('No subscribers', { status: 200 })

  const eventDate = event.event_date
    ? new Date(event.event_date).toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
    : 'TBD'

  // Send one email per subscriber (Resend free supports this)
  const results = await Promise.allSettled(
    subscribers.map(sub => {
      const unsubUrl = `${SUPABASE_URL}/functions/v1/unsubscribe?email=${encodeURIComponent(sub.email)}`
      return fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to:   sub.email,
          subject: `📅 Upcoming: ${event.title} — Ambassadors Club`,
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f2eb;font-family:'DM Sans',Arial,sans-serif;">
  <div style="max-width:560px;margin:2rem auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:#162040;padding:2rem;text-align:center;">
      <div style="width:48px;height:48px;border-radius:10px;background:linear-gradient(135deg,#c9a227,#a07a1a);display:inline-flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:700;color:#162040;margin-bottom:1rem;">AC</div>
      <h1 style="color:white;font-size:1.4rem;margin:0 0 0.25rem;">SDA Ambassadors Club</h1>
      <p style="color:rgba(255,255,255,0.55);font-size:0.8rem;margin:0;text-transform:uppercase;letter-spacing:0.1em;">Embakasi Central</p>
    </div>
    <!-- Body -->
    <div style="padding:2rem;">
      <p style="color:#7a89aa;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 0.5rem;">Upcoming Event</p>
      <h2 style="color:#162040;font-size:1.5rem;margin:0 0 1.5rem;">${event.title}</h2>
      <div style="background:#f5f2eb;border-radius:12px;padding:1.25rem;margin-bottom:1.5rem;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:0.4rem 0;color:#7a89aa;font-size:0.85rem;width:90px;">📅 Date</td><td style="padding:0.4rem 0;color:#162040;font-weight:600;font-size:0.9rem;">${eventDate}</td></tr>
          ${event.time?`<tr><td style="padding:0.4rem 0;color:#7a89aa;font-size:0.85rem;">🕐 Time</td><td style="padding:0.4rem 0;color:#162040;font-weight:600;font-size:0.9rem;">${event.time}</td></tr>`:''}
          ${event.location?`<tr><td style="padding:0.4rem 0;color:#7a89aa;font-size:0.85rem;">📍 Venue</td><td style="padding:0.4rem 0;color:#162040;font-weight:600;font-size:0.9rem;">${event.location}</td></tr>`:''}
        </table>
      </div>
      ${event.description?`<p style="color:#3d4a6b;font-size:0.95rem;line-height:1.7;margin:0 0 1.5rem;">${event.description}</p>`:''}
      <a href="${SITE_URL}/activities.html" style="display:inline-block;background:#c9a227;color:#162040;padding:0.8rem 1.75rem;border-radius:8px;font-weight:700;font-size:0.9rem;text-decoration:none;">View All Events →</a>
    </div>
    <!-- Footer -->
    <div style="background:#f5f2eb;padding:1.25rem 2rem;text-align:center;border-top:1px solid rgba(0,0,0,0.06);">
      <p style="color:#7a89aa;font-size:0.78rem;margin:0 0 0.5rem;">SDA Church Embakasi Central · Nairobi, Kenya</p>
      <p style="color:#7a89aa;font-size:0.75rem;margin:0;">
        <a href="${unsubUrl}" style="color:#7a89aa;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`
        })
      })
    })
  )

  const sent    = results.filter(r => r.status === 'fulfilled').length
  const failed  = results.filter(r => r.status === 'rejected').length

  return new Response(JSON.stringify({ sent, failed, total: subscribers.length }), {
    headers: { 'Content-Type': 'application/json' }
  })
})