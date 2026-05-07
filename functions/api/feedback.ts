interface Env {
  GITHUB_TOKEN: string;
  TURNSTILE_SECRET_KEY: string;
  KV_RATE_LIMIT: KVNamespace;
}

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
}

const REPO_OWNER = "tanchao";
const REPO_NAME = "tanchao.xyz";
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_SECONDS = 3600;

function hashIP(ip: string): string {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `rl:${Math.abs(hash).toString(36)}`;
}

async function verifyTurnstile(
  token: string,
  secret: string,
  ip: string,
): Promise<boolean> {
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    },
  );
  const data: TurnstileResponse = await res.json();
  return data.success;
}

async function checkRateLimit(
  kv: KVNamespace,
  key: string,
): Promise<boolean> {
  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) : 0;
  if (count >= RATE_LIMIT_MAX) return false;
  await kv.put(key, String(count + 1), {
    expirationTtl: RATE_LIMIT_WINDOW_SECONDS,
  });
  return true;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "https://tanchao.xyz",
    },
  });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";

  let payload: { body?: string; contact?: string; referrer?: string; "cf-turnstile-response"?: string };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  const { body, contact, referrer } = payload;
  const turnstileToken = payload["cf-turnstile-response"] || "";

  if (!body || body.length < 5 || body.length > 2000) {
    return jsonResponse({ error: "Feedback must be 5–2000 characters" }, 400);
  }

  if (!turnstileToken) {
    return jsonResponse({ error: "Please complete the verification" }, 400);
  }

  const turnstileValid = await verifyTurnstile(
    turnstileToken,
    env.TURNSTILE_SECRET_KEY,
    ip,
  );
  if (!turnstileValid) {
    return jsonResponse({ error: "Verification failed — please try again" }, 403);
  }

  const rateLimitKey = hashIP(ip);
  const allowed = await checkRateLimit(env.KV_RATE_LIMIT, rateLimitKey);
  if (!allowed) {
    return jsonResponse(
      { error: "Too many submissions — please try again later" },
      429,
    );
  }

  const issueTitle = body.slice(0, 60) + (body.length > 60 ? "…" : "");
  const issueBody = [
    "## User feedback",
    "",
    body,
    "",
    "---",
    "",
    `**Contact:** ${contact || "_not provided_"}`,
    `**Referrer:** ${referrer || "_unknown_"}`,
    `**IP hash:** \`${rateLimitKey}\``,
    "",
    "@claude please investigate this feedback and open a PR if it's actionable.",
  ].join("\n");

  const ghRes = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "tanchao-xyz-feedback",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody,
        labels: ["agent-task", "user-feedback"],
      }),
    },
  );

  if (!ghRes.ok) {
    const errorBody = await ghRes.text();
    console.error(`GitHub API error: ${ghRes.status} ${errorBody}`);
    return jsonResponse({ error: "Failed to submit feedback — please try again" }, 502);
  }

  const issue: { html_url: string } = await ghRes.json();
  return jsonResponse({ ok: true, issueUrl: issue.html_url });
};
