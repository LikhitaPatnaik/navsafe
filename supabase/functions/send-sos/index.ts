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
}

const formatOSMUrl = (lat: number, lng: number): string => {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=17`;
};

const sendTwilioSMS = async (
  to: string, 
  body: string
): Promise<{ success: boolean; error?: string }> => {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: 'Missing Twilio credentials' };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    console.log(`[SOS] Sending SMS to: ${to}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
    });

    const result = await response.json();
    if (response.ok) {
      console.log(`[SOS] ✅ SMS sent to ${to} - SID: ${result.sid}`);
      return { success: true };
    } else {
      console.error(`[SOS] ❌ SMS error for ${to}:`, JSON.stringify(result));
      return { success: false, error: result.message || 'SMS API error' };
    }
  } catch (error) {
    console.error(`[SOS] ❌ Exception sending SMS to ${to}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location, landmark, message, contactIds }: SOSRequest = await req.json();

    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      return new Response(
        JSON.stringify({ error: 'Valid location (lat, lng) is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase.from('emergency_contacts').select('*');
    
    if (contactIds && contactIds.length > 0) {
      query = query.in('id', contactIds);
    } else {
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

    console.log(`Sending SOS SMS to ${contacts.length} contacts`);

    const sendPromises = contacts.map(contact => sendTwilioSMS(contact.phone, sosMessage));
    const results = await Promise.all(sendPromises);
    
    const successCount = results.filter(r => r.success).length;
    const errors = results.filter(r => !r.success).map(r => r.error);

    console.log(`[SOS] SMS sent: ${successCount}/${contacts.length}`);

    return new Response(
      JSON.stringify({
        success: successCount > 0,
        sent: successCount,
        total: contacts.length,
        message: `SOS SMS sent to ${successCount}/${contacts.length} contacts`,
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
