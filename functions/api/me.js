import {
  getCookie
} from "../_shared/cookies.js";

import {
  sha256Base64Url
} from "../_shared/crypto.js";

export async function onRequestGet(context) {
  const rawSession = getCookie(
    context.request,
    "__Host-session"
  );

  if (!rawSession) {
    return Response.json(
      { authenticated: false },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  const sessionHash =
    await sha256Base64Url(rawSession);

  const now = Math.floor(Date.now() / 1000);

  const session = await context.env.DB.prepare(
    `SELECT issuer, subject, email, display_name
     FROM sessions
     WHERE id_hash = ?
       AND expires_at > ?`
  )
    .bind(sessionHash, now)
    .first();

  if (!session) {
    return Response.json(
      { authenticated: false },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  return Response.json(
    {
      issuer: session.issuer,
      subject: session.subject,
      email: session.email,
      displayName: session.display_name
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}