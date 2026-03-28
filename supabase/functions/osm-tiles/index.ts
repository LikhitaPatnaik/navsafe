import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TILE_PATH_REGEX = /\/osm-tiles\/(\d+)\/(\d+)\/(\d+)\.png$/;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  const url = new URL(req.url);
  const match = url.pathname.match(TILE_PATH_REGEX);

  if (!match) {
    return new Response("Invalid tile path", {
      status: 400,
      headers: corsHeaders,
    });
  }

  const [, z, x, y] = match;
  const tileUrl = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

  try {
    const tileResponse = await fetch(tileUrl, {
      headers: {
        "User-Agent": "NavSafeMapTileProxy/1.0 (+https://navsafemain.lovable.app)",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });

    if (!tileResponse.ok) {
      return new Response(`Tile fetch failed: ${tileResponse.status}`, {
        status: tileResponse.status,
        headers: corsHeaders,
      });
    }

    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", tileResponse.headers.get("Content-Type") ?? "image/png");
    headers.set("Cache-Control", tileResponse.headers.get("Cache-Control") ?? "public, max-age=86400, s-maxage=86400");

    return new Response(tileResponse.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("OSM tile proxy error:", error);

    return new Response("Failed to load map tile", {
      status: 500,
      headers: corsHeaders,
    });
  }
});