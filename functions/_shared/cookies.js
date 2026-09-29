export function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";

  for (const item of header.split(";")) {
    const [key, ...rest] = item.trim().split("=");

    if (key === name) {
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return rest.join("=");
      }
    }
  }

  return null;
}

export function oauthTransactionCookie(value) {
  return `__Host-oauth-tx=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
}

export function clearOAuthTransactionCookie() {
  return "__Host-oauth-tx=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

export function sessionCookie(value) {
  return `__Host-session=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`;
}

export function clearSessionCookie() {
  return "__Host-session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}