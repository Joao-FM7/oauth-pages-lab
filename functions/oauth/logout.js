import {
  getCookie,
  clearSessionCookie
} from "../_shared/cookies.js";

import {
  sha256Base64Url
} from "../_shared/crypto.js";

export async function onRequestPost(context) {
  const origin = context.request.headers.get("Origin");

  if (origin !== context.env.PUBLIC_BASE_URL) {
    return new Response("Forbidden", {
      status: 403,
      headers: {
        "Cache-Control": "no-store"
      }
    });
  }

  const rawSession = getCookie(
    context.request,
    "__Host-session"
  );

  if (rawSession) {
    const sessionHash =
      await sha256Base64Url(rawSession);

    await context.env.DB.prepare(
      "DELETE FROM sessions WHERE id_hash = ?"
    )
      .bind(sessionHash)
      .run();
  }

  const headers = new Headers();

  headers.set("Location", context.env.PUBLIC_BASE_URL);
  headers.set("Cache-Control", "no-store");

  headers.append(
    "Set-Cookie",
    clearSessionCookie()
  );

  return new Response(null, {
    status: 303,
    headers
  });
}