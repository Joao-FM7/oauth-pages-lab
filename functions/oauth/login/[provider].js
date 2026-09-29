import {
  randomBase64Url,
  sha256Base64Url
} from "../../_shared/crypto.js";

import {
  oauthTransactionCookie
} from "../../_shared/cookies.js";

import {
  getProviderConfig
} from "../../_shared/providers.js";

export async function onRequestGet(context) {
  const provider = context.params.provider;

  const config = getProviderConfig(provider, context.env);

  if (!config) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store" }
    });
  }

  const transactionId = randomBase64Url();
  const state = randomBase64Url();
  const codeVerifier = randomBase64Url();
  const nonce = provider === "google" ? randomBase64Url() : null;

  const transactionHash = await sha256Base64Url(transactionId);
  const stateHash = await sha256Base64Url(state);
  const codeChallenge = await sha256Base64Url(codeVerifier);

  const expiresAt = Math.floor(Date.now() / 1000) + 600;

  await context.env.DB.prepare(
    `INSERT INTO oauth_transactions
     (id_hash, provider, state_hash, nonce, code_verifier, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      transactionHash,
      provider,
      stateHash,
      nonce,
      codeVerifier,
      expiresAt
    )
    .run();

  const url = new URL(config.authorizationUrl);

  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  if (provider === "google") {
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("nonce", nonce);
  }

  const headers = new Headers();

  headers.set("Location", url.toString());
  headers.set("Cache-Control", "no-store");
  headers.append(
    "Set-Cookie",
    oauthTransactionCookie(transactionId)
  );

  return new Response(null, {
    status: 302,
    headers
  });
}