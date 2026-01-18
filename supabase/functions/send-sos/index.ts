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
  message?: string;
  contactIds?: string[];
}

const formatLocationUrl = (lat: number, lng: number): string => {
  return `https://www.google.com/maps?q=${lat},${lng}`;
};

const sendTwilioSMS = async (to: string, body: string): Promise<boolean> => {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!accountSid || !authToken || !fromNumber) {
    console.error('Missing Twilio credentials');
    return false;
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: fromNumber,
        Body: body,
      }),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log(`SMS sent to ${to}: ${result.sid}`);
      return true;
    } else {
      console.error(`Failed to send SMS to ${to}:`, result);
      return false;
    }
  } catch (error) {
    console.error(`Error sending SMS to ${to}:`, error);
    return false;
  }
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location, message, contactIds }: SOSRequest = await req.json();

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

    const locationUrl = formatLocationUrl(location.lat, location.lng);
    const sosMessage = message || 
      `🚨 SOS EMERGENCY ALERT 🚨\n\nI need help immediately!\n\n📍 My Location:\n${locationUrl}\n\nLat: ${location.lat.toFixed(6)}\nLng: ${location.lng.toFixed(6)}\n\nThis is an automated emergency alert.`;

    console.log(`Sending SOS to ${contacts.length} contacts`);

    // Send SMS to all contacts
    const sendPromises = contacts.map(contact => 
      sendTwilioSMS(contact.phone, sosMessage)
    );

    const results = await Promise.all(sendPromises);
    const successCount = results.filter(Boolean).length;

    console.log(`SOS sent successfully to ${successCount}/${contacts.length} contacts`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: contacts.length,
        message: `SOS alert sent to ${successCount} out of ${contacts.length} contacts`,
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
