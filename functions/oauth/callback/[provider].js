import {
  randomBase64Url,
  sha256Base64Url,
  basicAuth
} from "../../_shared/crypto.js";

import {
  getCookie,
  clearOAuthTransactionCookie,
  sessionCookie
} from "../../_shared/cookies.js";

import {
  getProviderConfig
} from "../../_shared/providers.js";

import {
  validateGoogleIdToken
} from "../../_shared/oidc.js";

function failure(message, status = 400) {
  const headers = new Headers();

  headers.set("Cache-Control", "no-store");
  headers.append(
    "Set-Cookie",
    clearOAuthTransactionCookie()
  );

  return new Response(message, {
    status,
    headers
  });
}

async function exchangeGoogle(config, code, verifier) {
  const body = new URLSearchParams();

  body.set("client_id", config.clientId);
  body.set("client_secret", config.clientSecret);
  body.set("code", code);
  body.set("redirect_uri", config.redirectUri);
  body.set("grant_type", "authorization_code");
  body.set("code_verifier", verifier);

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new Error("token_exchange_failed");
  }

  return response.json();
}

async function exchangeGitHub(config, code, verifier) {
  const body = new URLSearchParams();

  body.set("client_id", config.clientId);
  body.set("client_secret", config.clientSecret);
  body.set("code", code);
  body.set("redirect_uri", config.redirectUri);
  body.set("code_verifier", verifier);

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `github_token_http_${response.status}`
    );
  }

  if (data.error) {
    throw new Error(
      `github_token_error_${data.error}`
    );
  }

  return data;
}
  const body = new URLSearchParams();

  body.set("client_id", config.clientId);
  body.set("client_secret", config.clientSecret);
  body.set("code", code);
  body.set("redirect_uri", config.redirectUri);
  body.set("code_verifier", verifier);

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new Error("token_exchange_failed");
  }

  return response.json();
}

export async function onRequestGet(context) {
  const provider = context.params.provider;

  const config = getProviderConfig(provider, context.env);

  if (!config) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store" }
    });
  }

  const url = new URL(context.request.url);

  if (
    url.searchParams.has("error") ||
    !url.searchParams.get("code") ||
    !url.searchParams.get("state")
  ) {
    return failure("OAuth response rejected.");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const transactionCookie = getCookie(
    context.request,
    "__Host-oauth-tx"
  );

  if (!transactionCookie) {
    return failure("OAuth transaction rejected.");
  }

  const transactionHash =
    await sha256Base64Url(transactionCookie);

  const now = Math.floor(Date.now() / 1000);

  const transaction = await context.env.DB.prepare(
    `SELECT provider, state_hash, nonce, code_verifier, expires_at
     FROM oauth_transactions
     WHERE id_hash = ?
       AND provider = ?
       AND expires_at > ?`
  )
    .bind(transactionHash, provider, now)
    .first();

  if (!transaction) {
    return failure("OAuth transaction rejected.");
  }

  const receivedStateHash = await sha256Base64Url(state);

  if (receivedStateHash !== transaction.state_hash) {
    return failure("OAuth transaction rejected.");
  }

  await context.env.DB.prepare(
    "DELETE FROM oauth_transactions WHERE id_hash = ?"
  )
    .bind(transactionHash)
    .run();

  let identity;

  try {
    if (provider === "google") {
      const tokenData = await exchangeGoogle(
        config,
        code,
        transaction.code_verifier
      );

      if (typeof tokenData.id_token !== "string") {
        throw new Error("missing_id_token");
      }

      identity = await validateGoogleIdToken(
        tokenData.id_token,
        config.clientId,
        transaction.nonce
      );
    } else {
      const tokenData = await exchangeGitHub(
        config,
        code,
        transaction.code_verifier
      );

      if (
        typeof tokenData.access_token !== "string" ||
        typeof tokenData.token_type !== "string" ||
        tokenData.token_type.toLowerCase() !== "bearer"
      ) {
        throw new Error("invalid_github_token");
      }

      const accessToken = tokenData.access_token;

      const profileResponse = await fetch(
        "https://api.github.com/user",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2026-03-10",
            "User-Agent": "oauth-pages-lab"
          }
        }
      );

      if (!profileResponse.ok) {
        throw new Error("github_profile_failed");
      }

      const profile = await profileResponse.json();

      if (!Number.isInteger(profile.id)) {
        throw new Error("invalid_github_identity");
      }

      const revokeResponse = await fetch(
        `https://api.github.com/applications/${encodeURIComponent(
          config.clientId
        )}/grant`,
        {
          method: "DELETE",
          headers: {
            Authorization: basicAuth(
              config.clientId,
              config.clientSecret
            ),
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2026-03-10",
            "User-Agent": "oauth-pages-lab"
          },
          body: JSON.stringify({
            access_token: accessToken
          })
        }
      );

      if (revokeResponse.status !== 204) {
        throw new Error("github_revoke_failed");
      }

      identity = {
        issuer: "https://github.com",
        subject: String(profile.id),
        email:
          typeof profile.email === "string"
            ? profile.email
            : null,
        displayName:
          typeof profile.name === "string" && profile.name
            ? profile.name
            : profile.login
      };
    }

    const rawSession = randomBase64Url();
    const sessionHash =
      await sha256Base64Url(rawSession);

    const createdAt = Math.floor(Date.now() / 1000);
    const expiresAt = createdAt + 28800;

    await context.env.DB.prepare(
      `INSERT INTO sessions
       (id_hash, issuer, subject, email, display_name, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        sessionHash,
        identity.issuer,
        identity.subject,
        identity.email,
        identity.displayName,
        expiresAt,
        createdAt
      )
      .run();

    const headers = new Headers();

    headers.set("Location", context.env.PUBLIC_BASE_URL);
    headers.set("Cache-Control", "no-store");

    headers.append(
      "Set-Cookie",
      clearOAuthTransactionCookie()
    );

    headers.append(
      "Set-Cookie",
      sessionCookie(rawSession)
    );

    return new Response(null, {
      status: 302,
      headers
    });
  } catch (error) {
    console.log(
      "OAUTH_ERROR:",
      error instanceof Error ? error.message : "unknown"
    );

    return failure("Authentication failed.");
  }
}