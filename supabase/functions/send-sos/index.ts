import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SOSRequest {
  location: {
    lat: number;
    lng: number;
  };
  landmark?: string;
  message?: string;
  contactIds?: string[];
  channels?: ('sms' | 'whatsapp')[];
}

const formatOSMUrl = (lat: number, lng: number): string => {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=17`;
};

const sendTwilioMessage = async (
  to: string, 
  body: string, 
  channel: 'sms' | 'whatsapp'
): Promise<{ success: boolean; error?: string; channel: string }> => {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
  const whatsappSandbox = 'whatsapp:+14155238886';

  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: 'Missing Twilio credentials', channel };
  }

  const fromAddr = channel === 'whatsapp' ? whatsappSandbox : fromNumber;
  const toAddr = channel === 'whatsapp' ? `whatsapp:${to}` : to;

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    console.log(`[SOS] Sending ${channel} to: ${toAddr}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: toAddr, From: fromAddr, Body: body }),
    });

    const result = await response.json();
    if (response.ok) {
      console.log(`[SOS] ✅ ${channel} sent to ${to} - SID: ${result.sid}`);
      return { success: true, channel };
    } else {
      console.error(`[SOS] ❌ ${channel} error for ${to}:`, JSON.stringify(result));
      return { success: false, error: result.message || `${channel} API error`, channel };
    }
  } catch (error) {
    console.error(`[SOS] ❌ Exception sending ${channel} to ${to}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error', channel };
  }
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location, landmark, message, contactIds, channels }: SOSRequest = await req.json();
    const activeChannels: ('sms' | 'whatsapp')[] = channels && channels.length > 0 ? channels : ['sms', 'whatsapp'];

    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      return new Response(
        JSON.stringify({ error: 'Valid location (lat, lng) is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch emergency contacts
    let query = supabase.from('emergency_contacts').select('*');
    
    if (contactIds && contactIds.length > 0) {
      query = query.in('id', contactIds);
    } else {
      // Get primary contacts first, or all if none specified
      query = query.order('is_primary', { ascending: false });
    }

    const { data: contacts, error: contactsError } = await query;

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch emergency contacts' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No emergency contacts found', sent: 0 }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const locationUrl = formatOSMUrl(location.lat, location.lng);
    const landmarkText = landmark || 'Unknown Location';
    const sosMessage = message || 
      `ALERT: I'm at ${landmarkText}, Visakhapatnam. Exact loc: ${locationUrl} (${location.lat.toFixed(6)},${location.lng.toFixed(6)})`;

    console.log(`Sending SOS to ${contacts.length} contacts`);

    // Send SMS + WhatsApp to all contacts in parallel
    const sendPromises = contacts.flatMap(contact => [
      sendTwilioMessage(contact.phone, sosMessage, 'sms'),
      sendTwilioMessage(contact.phone, sosMessage, 'whatsapp'),
    ]);

    const results = await Promise.all(sendPromises);
    const smsResults = results.filter(r => r.channel === 'sms');
    const waResults = results.filter(r => r.channel === 'whatsapp');
    const smsSuccess = smsResults.filter(r => r.success).length;
    const waSuccess = waResults.filter(r => r.success).length;
    const errors = results.filter(r => !r.success).map(r => `${r.channel}: ${r.error}`);

    console.log(`[SOS] SMS: ${smsSuccess}/${contacts.length}, WhatsApp: ${waSuccess}/${contacts.length}`);

    const totalSuccess = smsSuccess + waSuccess;
    return new Response(
      JSON.stringify({
        success: totalSuccess > 0,
        sent: { sms: smsSuccess, whatsapp: waSuccess },
        total: contacts.length,
        message: `SOS: SMS ${smsSuccess}/${contacts.length}, WhatsApp ${waSuccess}/${contacts.length}`,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-sos function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
