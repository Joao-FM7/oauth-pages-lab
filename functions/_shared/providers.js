export function getProviderConfig(provider, env) {
  if (provider === "google") {
    return {
      name: "google",
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      redirectUri: `${env.PUBLIC_BASE_URL}/oauth/callback/google`
    };
  }

  if (provider === "github") {
    return {
      name: "github",
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      authorizationUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      redirectUri: `${env.PUBLIC_BASE_URL}/oauth/callback/github`
    };
  }

  return null;
}