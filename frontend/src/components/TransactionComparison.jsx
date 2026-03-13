import { useState } from "react";
import { approveTransaction, rejectTransaction } from "../utils/api";

function RiskBadge({ level }) {
  const colors = {
    critical: "bg-guard-danger/20 text-guard-danger border-guard-danger/50 shadow-lg shadow-guard-danger/20",
    high: "bg-guard-warning/20 text-guard-warning border-guard-warning/50 shadow-lg shadow-guard-warning/20",
    medium: "bg-guard-accent/20 text-guard-accent border-guard-accent/50 shadow-lg shadow-guard-accent/20",
    low: "bg-guard-safe/20 text-guard-safe border-guard-safe/50 shadow-lg shadow-guard-safe/20",
  };
  return (
    <span
      className={`text-xs font-bold px-3 py-1 rounded-full border ${
        colors[level] || colors.medium
      }`}
    >
      {level?.toUpperCase() || "UNKNOWN"}
    </span>
  );
}

function TxPanel({ title, tx, variant }) {
  // FIXED: Added null safety for tx object
  if (!tx || typeof tx !== "object") {
    return (
      <div className="flex-1 min-w-0 bg-guard-card border border-red-500/40 rounded-xl p-5 text-red-400">
        <h4 className="text-sm font-semibold mb-4">⚠️ {title}</h4>
        <p className="text-xs">Transaction data unavailable</p>
      </div>
    );
  }

  const isDanger = variant === "danger";
  const borderColor = isDanger
    ? "border-guard-danger/40 hover:border-guard-danger/60"
    : "border-guard-safe/40 hover:border-guard-safe/60";
  const titleColor = isDanger
    ? "text-guard-danger"
    : "text-guard-safe";

  return (
    <div className={`flex-1 min-w-0 bg-guard-card border ${borderColor} rounded-xl p-5 transition-all duration-300 hover:shadow-lg`}>
      <h4 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${titleColor}`}>
        {isDanger ? "⚠️ Original Transaction" : "✓ AgentGuard Safe Version"}
      </h4>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Function:</span>
          <span className="text-gray-100 font-mono text-xs bg-black px-2 py-1 rounded">
            {tx.function_name || "unknown"}
          </span>
        </div>
        <div>
          <span className="text-gray-400 block mb-1">To Address:</span>
          <span className="text-gray-100 break-all text-xs font-mono bg-black p-2 rounded block">
            {tx.to_address || "N/A"}
          </span>
        </div>
        <div>
          <span className="text-gray-400 block mb-1">Arguments:</span>
          <pre className="text-xs text-gray-200 mt-1 bg-black rounded p-3 max-w-full overflow-x-auto whitespace-pre-wrap break-all border border-guard-accent/10">
            {JSON.stringify(tx.args || {}, null, 2)}
          </pre>
        </div>
        {tx.rewrite_reason && (
          <div className="mt-3 text-xs text-guard-safe bg-guard-safe/15 rounded-lg p-3 border border-guard-safe/30 animate-pulse-eth">
            <span className="font-semibold">🔧 Modification: </span>
            {tx.rewrite_reason}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TransactionComparison({ result, onAction }) {
  // FIXED: Added loading states for buttons
  const [approveLoading, setApproveLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  // FIXED: Added null safety check with detailed validation
  if (!result?.data || typeof result.data !== "object") {
    return null;
  }

  // FIXED: Safely destructure with defaults
  const {
    original_tx = {},
    safe_tx = {},
    risk_report = {},
    llm_analysis = {},
    decision_context = {},
    tx_id = "",
  } = result.data;

  // FIXED: Validate tx_id before allowing actions
  const isActionable = !!tx_id;

  async function handleApprove() {
    if (!isActionable || approveLoading) return;

    setApproveLoading(true);
    setActionError(null);

    try {
      const res = await approveTransaction(tx_id);
      
      // FIXED: Validate response before passing to parent
      if (!res || typeof res !== "object") {
        throw new Error("Invalid response from server");
      }
      
      onAction?.({ action: "approved", ...res });
    } catch (err) {
      console.error("Approval failed:", err);
      const errorMsg = err.message || "Failed to approve transaction";
      setActionError(errorMsg);
      onAction?.({ action: "error", error: errorMsg });
    } finally {
      setApproveLoading(false);
    }
  }

  async function handleReject() {
    if (!isActionable || rejectLoading) return;

    setRejectLoading(true);
    setActionError(null);

    try {
      const res = await rejectTransaction(tx_id, "User rejected risky transaction");
      
      // FIXED: Validate response before passing to parent
      if (!res || typeof res !== "object") {
        throw new Error("Invalid response from server");
      }
      
      onAction?.({ action: "rejected", ...res });
    } catch (err) {
      console.error("Rejection failed:", err);
      const errorMsg = err.message || "Failed to reject transaction";
      setActionError(errorMsg);
      onAction?.({ action: "error", error: errorMsg });
    } finally {
      setRejectLoading(false);
    }
  }

  return (
    <div className="card-glow bg-guard-card border border-guard-accent/20 rounded-xl p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-xl font-bold text-glow-cyan">🔍 Transaction Analysis</h3>
          <p className="text-xs text-gray-500 mt-1">Comparing original vs AgentGuard-optimized transaction</p>
          {typeof risk_report?.risk_score === "number" && (
            <p className="text-xs text-gray-400 mt-1">
              Risk Score: <span className="text-guard-warning font-semibold">{risk_report.risk_score}/100</span>
              {risk_report?.policy_action && (
                <span className="ml-2">Policy: <span className="text-guard-accent">{risk_report.policy_action}</span></span>
              )}
            </p>
          )}
        </div>
        <RiskBadge level={risk_report?.risk_level} />
      </div>

      {/* FIXED: Show error message if action failed */}
      {actionError && (
        <div className="px-4 py-3 bg-guard-danger/10 border border-guard-danger/30 rounded-lg text-guard-danger text-sm">
          ❌ {actionError}
        </div>
      )}

      {/* Risk Flags */}
      {Array.isArray(risk_report?.flags) && risk_report.flags.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-guard-danger/80 uppercase tracking-wider">⚡ Detected Risks</p>
          {risk_report.flags.map((flag, i) => (
            <div
              key={i}
              className="flex items-start gap-3 bg-guard-danger/10 border border-guard-danger/30 rounded-lg p-4 hover:border-guard-danger/50 transition-all animate-slide-in"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span className="text-guard-danger text-lg mt-0.5 flex-shrink-0">⚠️</span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-guard-danger">
                  {(flag?.type || "unknown").replace(/_/g, " ").toUpperCase()} — {flag?.severity || "unknown"}
                </div>
                <div className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  {flag?.description || "No description available"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LLM Explanation */}
      {llm_analysis && Object.keys(llm_analysis).length > 0 && (
        <div className="glass glass-hover rounded-xl p-5 space-y-3 border border-guard-accent/30">
          <h4 className="text-sm font-semibold text-guard-accent flex items-center gap-2">
            🧠 AI Analysis
          </h4>
          <div className="space-y-2.5 text-sm">
            {llm_analysis.intent_summary && (
              <p className="text-gray-300">
                <span className="text-guard-safe font-semibold">Intent:</span>{" "}
                <span className="text-gray-300">{llm_analysis.intent_summary}</span>
              </p>
            )}
            {llm_analysis.risk_explanation && (
              <p className="text-gray-300">
                <span className="text-guard-danger font-semibold">Risk:</span>{" "}
                <span className="text-gray-300">{llm_analysis.risk_explanation}</span>
              </p>
            )}
            {llm_analysis.safe_action && (
              <p className="text-gray-300">
                <span className="text-guard-safe font-semibold">Recommendation:</span>{" "}
                <span className="text-gray-300">{llm_analysis.safe_action}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Plain-English Decision */}
      {decision_context && Object.keys(decision_context).length > 0 && (
        <div className="rounded-xl p-5 border border-guard-accent/20 bg-black/40 space-y-3">
          <h4 className="text-sm font-semibold text-guard-accent">
            Human Decision Checkpoint
          </h4>
          <div className="space-y-2 text-sm">
            {decision_context.ai_tried && (
              <p className="text-gray-300">
                <span className="text-guard-danger font-semibold">AI Tried:</span>{" "}
                {decision_context.ai_tried}
              </p>
            )}
            {decision_context.why_risky && (
              <p className="text-gray-300">
                <span className="text-guard-danger font-semibold">What Was Wrong:</span>{" "}
                {decision_context.why_risky}
              </p>
            )}
            {decision_context.agentguard_proposes && (
              <p className="text-gray-300">
                <span className="text-guard-safe font-semibold">AgentGuard Proposes:</span>{" "}
                {decision_context.agentguard_proposes}
              </p>
            )}
            {decision_context.human_choice_prompt && (
              <p className="text-xs text-gray-400">
                {decision_context.human_choice_prompt}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Side-by-side comparison with animated arrow */}
      <div className="relative overflow-hidden">
        <div className="flex min-w-0 gap-4 flex-col md:flex-row items-stretch">
          <TxPanel
            title="Original Transaction"
            tx={original_tx}
            variant="danger"
          />
          
          {/* Arrow indicator */}
          <div className="hidden md:flex items-center justify-center">
            <div className="flex flex-col items-center gap-1 animate-drift">
              <span className="text-guard-accent text-xl">→</span>
            </div>
          </div>
          
          <TxPanel
            title="Safe Transaction"
            tx={safe_tx}
            variant="safe"
          />
        </div>
      </div>

      {/* Action Buttons - FIXED: Added loading states, disabled state, and error feedback */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleApprove}
          disabled={!isActionable || approveLoading || rejectLoading}
          className="flex-1 btn-glow px-4 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-guard-safe/90 to-guard-safe/70 hover:from-guard-safe to-guard-safe/80 border border-guard-safe/50 hover:shadow-lg hover:shadow-guard-safe/30 transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {approveLoading ? "⏳ Approving..." : "✅ Approve Safe Transaction"}
        </button>
        <button
          onClick={handleReject}
          disabled={!isActionable || approveLoading || rejectLoading}
          className="flex-1 btn-glow px-4 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-guard-danger/80 to-guard-danger/60 hover:from-guard-danger to-guard-danger/70 border border-guard-danger/50 hover:shadow-lg hover:shadow-guard-danger/30 transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {rejectLoading ? "⏳ Rejecting..." : "✕ Reject & Block"}
        </button>
      </div>
    </div>
  );
}
