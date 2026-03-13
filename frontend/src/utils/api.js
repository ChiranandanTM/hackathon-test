// FIXED: Import from centralized config
import { apiCall } from "../config.js";

/**
 * FIXED: Use centralized apiCall wrapper that includes:
 * - Response status validation
 * - JSON parse error handling
 * - Timeout handling
 * - Retry logic
 */

export async function interceptTransaction(tx) {
  try {
    return await apiCall("/intercept", {
      method: "POST",
      body: tx,
    });
  } catch (error) {
    console.error("Interception failed:", error);
    throw new Error(error.message || "Failed to analyze transaction");
  }
}

export async function approveTransaction(txId) {
  try {
    return await apiCall(`/approve/${txId}`, {
      method: "POST",
    });
  } catch (error) {
    console.error("Approval failed:", error);
    throw new Error(error.message || "Failed to approve transaction");
  }
}

export async function rejectTransaction(txId, reason = "") {
  try {
    return await apiCall(`/reject/${txId}`, {
      method: "POST",
      body: { reason },
    });
  } catch (error) {
    console.error("Rejection failed:", error);
    throw new Error(error.message || "Failed to reject transaction");
  }
}

export async function fetchAuditLog() {
  try {
    return await apiCall("/audit");
  } catch (error) {
    console.error("Audit log fetch failed:", error);
    throw new Error(error.message || "Failed to fetch audit log");
  }
}

export async function fetchAuditEvidence(txId) {
  try {
    return await apiCall(`/audit/evidence/${txId}`);
  } catch (error) {
    console.error("Evidence fetch failed:", error);
    throw new Error(error.message || "Failed to fetch transaction evidence");
  }
}

export async function fetchJudgeScorecard() {
  try {
    return await apiCall("/judge/scorecard");
  } catch (error) {
    console.error("Scorecard fetch failed:", error);
    throw new Error(error.message || "Failed to fetch judge scorecard");
  }
}
