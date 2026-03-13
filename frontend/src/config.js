// FIXED: Created centralized API configuration to replace hardcoded URLs

const defaultBaseUrl = (() => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:8000";
    }
    // In deployed hosting, route to backend rewrite (e.g., Firebase /api).
    return "/api";
  }

  return "http://localhost:8000";
})();

function normalizeBaseUrl(url) {
  return String(url || "").replace(/\/$/, "");
}

function buildBaseUrlCandidates() {
  const explicit = normalizeBaseUrl(import.meta.env.VITE_API_URL || "");
  const explicitFallback = normalizeBaseUrl(import.meta.env.VITE_API_FALLBACK_URL || "");

  const candidates = [];
  if (explicit) {
    candidates.push(explicit);
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocalHost = host === "localhost" || host === "127.0.0.1";

    if (isLocalHost) {
      candidates.push("http://localhost:8000");
      candidates.push("http://127.0.0.1:8000");
      candidates.push("/api");
    } else {
      // When frontend is hosted remotely but backend is running locally for demo,
      // prefer local backend before Firebase Hosting rewrite.
      candidates.push("http://localhost:8000");
      candidates.push("http://127.0.0.1:8000");
      candidates.push("/api");
    }
  } else {
    candidates.push("http://localhost:8000");
  }

  if (explicitFallback) {
    candidates.push(explicitFallback);
  }

  // Deduplicate while preserving order.
  return [...new Set(candidates.filter(Boolean).map(normalizeBaseUrl))];
}

export const API_CONFIG = {
  BASE_URL: defaultBaseUrl,
  BASE_URL_CANDIDATES: buildBaseUrlCandidates(),
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 2,
};

/**
 * Centralized fetch wrapper with error handling
 */
export async function apiCall(endpoint, options = {}) {
  const defaults = {
    headers: {
      "Content-Type": "application/json",
    },
    timeout: API_CONFIG.TIMEOUT,
  };

  const finalOptions = { ...defaults, ...options };

  if (finalOptions.body && typeof finalOptions.body === "object") {
    finalOptions.body = JSON.stringify(finalOptions.body);
  }

  const bases = API_CONFIG.BASE_URL_CANDIDATES?.length
    ? API_CONFIG.BASE_URL_CANDIDATES
    : [normalizeBaseUrl(API_CONFIG.BASE_URL || "http://localhost:8000")];

  let lastError = null;
  let preferredError = null;

  for (const base of bases) {
    const url = `${base}${endpoint}`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), finalOptions.timeout);

      const response = await fetch(url, {
        ...finalOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        const contentType = response.headers.get("content-type") || "";
        const isFirebaseApi404 =
          response.status === 404 && String(base).startsWith("/api") && contentType.includes("text/html");

        if (isFirebaseApi404) {
          const err = new Error(
            "Backend API is not deployed on Firebase yet. Deploy Cloud Function 'api' (Blaze plan required), or set VITE_API_URL to a live backend URL."
          );
          preferredError = err;
          lastError = err;
          continue;
        }

        const compactBody =
          errorBody && contentType.includes("text/html")
            ? "HTML error response"
            : (errorBody || response.statusText);
        throw new Error(`HTTP ${response.status}: ${compactBody}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === "AbortError") {
        const err = new Error("Request timeout - server took too long to respond");
        lastError = err;
        continue;
      }

      // Network failures can occur if one base URL is unreachable; try next candidate.
      if (String(error?.message || "").toLowerCase().includes("failed to fetch")) {
        lastError = new Error("Unable to reach backend API.");
        continue;
      }

      throw error;
    }
  }

  throw (
    preferredError ||
    lastError ||
    new Error("Unable to reach backend API. Check backend deployment or VITE_API_URL.")
  );
}

/**
 * Transaction endpoints
 */
export async function interceptTransaction(tx) {
  return apiCall("/intercept", {
    method: "POST",
    body: tx,
  });
}

export async function approveTransaction(txId) {
  return apiCall(`/approve/${txId}`, {
    method: "POST",
  });
}

export async function rejectTransaction(txId, reason = "") {
  return apiCall(`/reject/${txId}`, {
    method: "POST",
    body: { reason },
  });
}

export async function fetchAuditLog() {
  return apiCall("/audit");
}

export async function fetchAuditEvidence(txId) {
  return apiCall(`/audit/evidence/${txId}`);
}

export async function fetchJudgeScorecard() {
  return apiCall("/judge/scorecard");
}

export async function fetchHealthCheck() {
  return apiCall("/");
}
