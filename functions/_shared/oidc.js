import {
  base64UrlToBytes,
  base64UrlToJson
} from "./crypto.js";

export async function validateGoogleIdToken(idToken, clientId, expectedNonce) {
  const parts = idToken.split(".");

  if (parts.length !== 3) {
    throw new Error("invalid_id_token");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  const header = base64UrlToJson(encodedHeader);
  const payload = base64UrlToJson(encodedPayload);

  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new Error("invalid_id_token");
  }

  const discoveryResponse = await fetch(
    "https://accounts.google.com/.well-known/openid-configuration"
  );

  if (!discoveryResponse.ok) {
    throw new Error("oidc_discovery_failed");
  }

  const discovery = await discoveryResponse.json();

  const jwksResponse = await fetch(discovery.jwks_uri);

  if (!jwksResponse.ok) {
    throw new Error("jwks_failed");
  }

  const jwks = await jwksResponse.json();

  const jwk = jwks.keys.find((key) => key.kid === header.kid);

  if (!jwk) {
    throw new Error("unknown_key");
  }

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["verify"]
  );

  const data = new TextEncoder().encode(
    `${encodedHeader}.${encodedPayload}`
  );

  const signature = base64UrlToBytes(encodedSignature);

  const validSignature = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature,
    data
  );

  if (!validSignature) {
    throw new Error("invalid_signature");
  }

  const now = Math.floor(Date.now() / 1000);

  if (payload.iss !== discovery.issuer) {
    throw new Error("invalid_issuer");
  }

  const audienceValid = Array.isArray(payload.aud)
    ? payload.aud.includes(clientId)
    : payload.aud === clientId;

  if (!audienceValid) {
    throw new Error("invalid_audience");
  }

  if (
    typeof payload.exp !== "number" ||
    payload.exp <= now ||
    typeof payload.iat !== "number" ||
    payload.iat > now + 60
  ) {
    throw new Error("invalid_time");
  }

  if (payload.nonce !== expectedNonce) {
    throw new Error("invalid_nonce");
  }

  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("invalid_subject");
  }

  return {
    issuer: payload.iss,
    subject: payload.sub,
    email: typeof payload.email === "string" ? payload.email : null,
    displayName:
      typeof payload.name === "string"
        ? payload.name
        : typeof payload.email === "string"
          ? payload.email
          : "Google user"
  };
}