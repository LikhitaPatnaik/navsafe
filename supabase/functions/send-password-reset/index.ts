import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
  resetUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Password reset function called");
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, resetUrl }: PasswordResetRequest = await req.json();
    console.log("Processing password reset for:", email);

    // Validate required fields
    if (!email || !resetUrl) {
      console.error("Missing required fields");
      throw new Error("Missing required fields: email and resetUrl are required");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error("Invalid email format");
      throw new Error("Invalid email format");
    }

    const emailResponse = await resend.emails.send({
      from: "NavSafe <noreply@resend.dev>",
      to: [email],
      subject: "Reset your NavSafe password",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <tr>
                    <td style="padding: 40px;">
                      <h1 style="color: #18181b; font-size: 24px; font-weight: 600; margin: 0 0 24px 0; text-align: center;">
                        🔒 Password Reset Request
                      </h1>
                      <p style="color: #52525b; font-size: 16px; line-height: 24px; margin: 0 0 24px 0;">
                        We received a request to reset your password for your NavSafe account. Click the button below to set a new password:
                      </p>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" style="padding: 16px 0;">
                            <a href="${resetUrl}" style="display: inline-block; background-color: #8b5cf6; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
                              Reset Password
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="color: #71717a; font-size: 14px; line-height: 22px; margin: 24px 0 0 0;">
                        If you didn't request this password reset, you can safely ignore this email. This link will expire in 1 hour.
                      </p>
                      <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
                      <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
                        NavSafe - Your Safety, Our Priority
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log("Password reset email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-password-reset function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
