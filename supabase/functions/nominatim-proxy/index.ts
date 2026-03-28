import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json; charset=utf-8",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const requestUrl = new URL(req.url);
  const pathname = requestUrl.pathname.replace(/\/+$/, "");
  const acceptLanguage = req.headers.get("accept-language") ?? "en";

  let upstreamUrl: URL | null = null;

  if (pathname.endsWith("/search")) {
    const query = requestUrl.searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(10, Math.max(1, Number.parseInt(requestUrl.searchParams.get("limit") ?? "5", 10) || 5));

    if (query.length < 3) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    upstreamUrl = new URL("https://nominatim.openstreetmap.org/search");
    upstreamUrl.searchParams.set("format", "jsonv2");
    upstreamUrl.searchParams.set("addressdetails", "1");
    upstreamUrl.searchParams.set("limit", String(limit));
    upstreamUrl.searchParams.set("q", query);
  } else if (pathname.endsWith("/reverse")) {
    const lat = requestUrl.searchParams.get("lat")?.trim();
    const lon = requestUrl.searchParams.get("lon")?.trim();

    if (!lat || !lon) {
      return new Response(JSON.stringify({ error: "Missing lat/lon" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    upstreamUrl = new URL("https://nominatim.openstreetmap.org/reverse");
    upstreamUrl.searchParams.set("format", "jsonv2");
    upstreamUrl.searchParams.set("lat", lat);
    upstreamUrl.searchParams.set("lon", lon);
  }

  if (!upstreamUrl) {
    return new Response(JSON.stringify({ error: "Invalid proxy path" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      headers: {
        "Accept": "application/json",
        "Accept-Language": acceptLanguage,
        "User-Agent": "NavSafeGeocoder/1.0 (+https://navsafemain.lovable.app)",
      },
    });

    const body = await upstreamResponse.text();
    const headers = new Headers(jsonHeaders);
    headers.set("Cache-Control", upstreamResponse.headers.get("Cache-Control") ?? "public, max-age=300, s-maxage=300");

    return new Response(body, {
      status: upstreamResponse.status,
      headers,
    });
  } catch (error) {
    console.error("Nominatim proxy error:", error);

    return new Response(JSON.stringify({ error: "Failed to fetch geocoding data" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});