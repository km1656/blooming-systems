interface Env {
  RESEND_API_KEY: string;
  CONTACT_TO_EMAIL: string;
  TURNSTILE_SECRET: string;
}

const MAX_LENGTHS = {
  firstName: 50,
  lastName: 50,
  email: 100,
  company: 100,
  phone: 25,
  help: 50,
  project: 2000,
};

const ALLOWED_HELP = new Set([
  "iam-consulting",
  "implementation-integration",
  "identity-governance",
  "directory-services",
  "cloud-identity",
  "platform-services",
  "managed-iam",
  "other",
]);

const HELP_LABELS: Record<string, string> = {
  "iam-consulting": "IAM Consulting",
  "implementation-integration": "Implementation & Integration",
  "identity-governance": "Identity Governance & Administration",
  "directory-services": "Directory Services",
  "cloud-identity": "Cloud Identity",
  "platform-services": "IAM Platform Services",
  "managed-iam": "Managed IAM Services",
  other: "Other",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store",
    },
  });
}

async function verifyTurnstile(
  token: string,
  secret: string,
  remoteIp?: string
): Promise<boolean> {
  if (!token || !secret) {
    return false;
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });

  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    console.error(
      "Turnstile verification request failed:",
      response.status
    );

    return false;
  }

  const result = (await response.json()) as {
    success?: boolean;
    hostname?: string;
    action?: string;
    "error-codes"?: string[];
  };

  if (!result.success) {
    console.warn("Turnstile verification failed:", result["error-codes"]);
    return false;
  }

  // Verify that the token belongs to this website.
  if (result.hostname && result.hostname !== "www.bloomingsys.com") {
    console.warn("Unexpected Turnstile hostname:", result.hostname);
    return false;
  }

  // Verify that the token was issued for the contact form.
  if (result.action && result.action !== "contact") {
    console.warn("Unexpected Turnstile action:", result.action);
    return false;
  }

  return true;
}

export const onRequestPost = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  try {
    if (!env.TURNSTILE_SECRET) {
      console.error("Missing TURNSTILE_SECRET");

      return jsonResponse(
        {
          success: false,
          message: "The contact service is not configured.",
        },
        500
      );
    }

    if (!env.RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY");

      return jsonResponse(
        {
          success: false,
          message: "The contact service is not configured.",
        },
        500
      );
    }

    if (!env.CONTACT_TO_EMAIL) {
      console.error("Missing CONTACT_TO_EMAIL");

      return jsonResponse(
        {
          success: false,
          message: "The contact service is not configured.",
        },
        500
      );
    }

    const formData = await request.formData();

    /*
     * Honeypot.
     *
     * Real users never see this field.
     * If a bot fills it, quietly accept the request without
     * sending an email.
     */
    const website = clean(formData.get("website"));

    if (website) {
      return jsonResponse({
        success: true,
        message: "Thank you. Your inquiry has been received.",
      });
    }

    /*
     * Turnstile verification.
     *
     * This MUST happen server-side before Resend is called.
     */
    const turnstileToken = clean(
      formData.get("cf-turnstile-response")
    );

    const remoteIp =
      request.headers.get("CF-Connecting-IP") || undefined;

    const turnstileValid = await verifyTurnstile(
      turnstileToken,
      env.TURNSTILE_SECRET,
      remoteIp
    );

    if (!turnstileValid) {
      return jsonResponse(
        {
          success: false,
          message:
            "Security verification failed. Please refresh the page and try again.",
        },
        400
      );
    }

    const firstName = clean(formData.get("firstName"));
    const lastName = clean(formData.get("lastName"));
    const email = clean(formData.get("email")).toLowerCase();
    const company = clean(formData.get("company"));
    const phone = clean(formData.get("phone"));
    const help = clean(formData.get("help"));
    const project = clean(formData.get("project"));

    /*
     * Required-field validation.
     */
    if (
      !firstName ||
      !lastName ||
      !email ||
      !company ||
      !help ||
      !project
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Please complete all required fields.",
        },
        400
      );
    }

    /*
     * Length validation.
     */
    if (
      firstName.length > MAX_LENGTHS.firstName ||
      lastName.length > MAX_LENGTHS.lastName ||
      email.length > MAX_LENGTHS.email ||
      company.length > MAX_LENGTHS.company ||
      phone.length > MAX_LENGTHS.phone ||
      help.length > MAX_LENGTHS.help ||
      project.length > MAX_LENGTHS.project
    ) {
      return jsonResponse(
        {
          success: false,
          message: "One or more fields exceed the allowed length.",
        },
        400
      );
    }

    if (firstName.length < 2 || lastName.length < 2) {
      return jsonResponse(
        {
          success: false,
          message: "Please enter your first and last name.",
        },
        400
      );
    }

    if (company.length < 2) {
      return jsonResponse(
        {
          success: false,
          message: "Please enter your company name.",
        },
        400
      );
    }

    if (project.length < 20) {
      return jsonResponse(
        {
          success: false,
          message:
            "Please provide a little more information about your project.",
        },
        400
      );
    }

    if (!EMAIL_PATTERN.test(email)) {
      return jsonResponse(
        {
          success: false,
          message: "Please enter a valid email address.",
        },
        400
      );
    }

    if (phone) {
      const phoneDigits = phone.replace(/\D/g, "");

      if (phoneDigits.length < 7) {
        return jsonResponse(
          {
            success: false,
            message: "Please enter a valid phone number.",
          },
          400
        );
      }
    }

    if (!ALLOWED_HELP.has(help)) {
      return jsonResponse(
        {
          success: false,
          message: "Please select a valid area of assistance.",
        },
        400
      );
    }

    const helpLabel = HELP_LABELS[help] ?? help;

    /*
     * Escape all user-controlled content before putting it into HTML.
     */
    const safeFirstName = escapeHtml(firstName);
    const safeLastName = escapeHtml(lastName);
    const safeEmail = escapeHtml(email);
    const safeCompany = escapeHtml(company);
    const safePhone = escapeHtml(phone || "Not provided");
    const safeHelp = escapeHtml(helpLabel);
    const safeProject = escapeHtml(project).replace(/\n/g, "<br>");

    const textBody = [
      "New website inquiry",
      "",
      `Name: ${firstName} ${lastName}`,
      `Email: ${email}`,
      `Company: ${company}`,
      `Phone: ${phone || "Not provided"}`,
      `Area: ${helpLabel}`,
      "",
      "Project details:",
      project,
    ].join("\n");

    const htmlBody = `
      <!doctype html>
      <html lang="en">
        <body style="margin:0;padding:0;background:#f7f9fc;color:#07152f;font-family:Arial,Helvetica,sans-serif;">
          <div style="max-width:680px;margin:0 auto;padding:40px 20px;">
            <div style="background:#ffffff;border:1px solid #dce1e8;">

              <div style="padding:28px 32px;border-bottom:1px solid #dce1e8;">
                <div style="font-size:12px;font-weight:700;letter-spacing:.12em;color:#0031ff;">
                  BLOOMING SYSTEMS INC.
                </div>

                <h1 style="margin:12px 0 0;font-size:24px;line-height:1.3;color:#07152f;">
                  New website inquiry
                </h1>
              </div>

              <div style="padding:32px;">
                <table style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td style="padding:8px 0;font-weight:700;width:140px;">
                      Name
                    </td>
                    <td style="padding:8px 0;">
                      ${safeFirstName} ${safeLastName}
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:8px 0;font-weight:700;">
                      Email
                    </td>
                    <td style="padding:8px 0;">
                      ${safeEmail}
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:8px 0;font-weight:700;">
                      Company
                    </td>
                    <td style="padding:8px 0;">
                      ${safeCompany}
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:8px 0;font-weight:700;">
                      Phone
                    </td>
                    <td style="padding:8px 0;">
                      ${safePhone}
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:8px 0;font-weight:700;">
                      Area
                    </td>
                    <td style="padding:8px 0;">
                      ${safeHelp}
                    </td>
                  </tr>
                </table>

                <div style="margin-top:28px;padding-top:24px;border-top:1px solid #dce1e8;">
                  <div style="font-weight:700;margin-bottom:12px;">
                    Project details
                  </div>

                  <div style="line-height:1.7;color:#536074;">
                    ${safeProject}
                  </div>
                </div>
              </div>

              <div style="padding:20px 32px;background:#f7f9fc;color:#697386;font-size:12px;">
                Submitted through the Blooming Systems website contact form.
              </div>

            </div>
          </div>
        </body>
      </html>
    `;

    /*
     * Send through Resend.
     */
    const resendResponse = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Blooming Systems Website <website@bloomingsys.com>",
          to: [env.CONTACT_TO_EMAIL],
          reply_to: email,
          subject: `Website Contact: ${firstName} ${lastName}`,
          text: textBody,
          html: htmlBody,
        }),
      }
    );

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();

      console.error("Resend API error:", {
        status: resendResponse.status,
        response: errorText,
      });

      return jsonResponse(
        {
          success: false,
          message:
            "We could not send your inquiry right now. Please try again or call us directly.",
        },
        502
      );
    }

    return jsonResponse({
      success: true,
      message: "Thank you. Your inquiry has been received.",
    });
  } catch (error) {
    console.error("Contact form error:", error);

    return jsonResponse(
      {
        success: false,
        message:
          "Something went wrong while sending your inquiry. Please try again.",
      },
      500
    );
  }
};

export const onRequestOptions = async (): Promise<Response> => {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "POST, OPTIONS",
    },
  });
};