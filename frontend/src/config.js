// FIXED: Created centralized API configuration to replace hardcoded URLs

export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 2,
};

/**
 * Centralized fetch wrapper with error handling
 */
export async function apiCall(endpoint, options = {}) {
  const url = `${API_CONFIG.BASE_URL}${endpoint}`;
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
        response.status === 404 &&
        String(API_CONFIG.BASE_URL).startsWith("/api") &&
        contentType.includes("text/html");

      if (isFirebaseApi404) {
        throw new Error(
          "Backend API is not deployed on Firebase yet. Deploy Cloud Function 'api' (Blaze plan required), or set VITE_API_URL to a live backend URL."
        );
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
      throw new Error("Request timeout - server took too long to respond");
    }
    throw error;
  }
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
