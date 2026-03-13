import { useState, useEffect, useRef } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { fetchAuditEvidence } from "../utils/api";

// FIXED: Added modal component for evidence details
function EvidenceModal({ record, onClose }) {
  const [evidence, setEvidence] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadEvidence();
  }, [record]);

  async function loadEvidence() {
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchAuditEvidence(record?._id);
      if (!data || typeof data !== "object") {
        throw new Error("Invalid evidence response");
      }
      setEvidence(data);
    } catch (err) {
      console.error("Failed to load evidence:", err);
      setError(err.message || "Failed to load evidence");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-guard-card border border-guard-accent/30 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto space-y-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-glow-cyan">📦 Transaction Evidence</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {loading && (
          <div className="text-center py-8 text-gray-400">
            <span className="loading-dots"></span>
            <p className="mt-3 text-guard-accent font-medium">Loading evidence...</p>
          </div>
        )}

        {error && (
          <div className="px-4 py-3 bg-guard-danger/10 border border-guard-danger/30 rounded-lg text-guard-danger text-sm">
            ❌ {error}
          </div>
        )}

        {evidence && (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Status</p>
                <p className="text-sm font-semibold text-guard-safe">{evidence.status?.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Quality</p>
                <p className="text-sm font-semibold text-guard-accent">{evidence.quality}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Risk Level</p>
                <p className="text-sm font-semibold text-guard-warning">{evidence.risk?.level?.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Risk Score</p>
                <p className="text-sm font-semibold">{evidence.risk?.score || "N/A"}</p>
              </div>
            </div>

            {evidence.risk?.flags && evidence.risk.flags.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Detected Threats</p>
                <div className="space-y-2">
                  {evidence.risk.flags.map((flag, i) => (
                    <div key={i} className="text-xs bg-guard-danger/10 border border-guard-danger/20 rounded p-2">
                      <span className="font-semibold text-guard-danger">{flag.type}</span>
                      <span className="text-gray-400 ml-2">{flag.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {evidence.decision_context && Object.keys(evidence.decision_context).length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Decision Context</p>
                <div className="text-xs bg-black/40 rounded p-3 space-y-1 font-mono">
                  <div><span className="text-guard-accent">Why Risky:</span> {evidence.decision_context.why_risky}</div>
                  <div><span className="text-guard-safe">Proposed:</span> {evidence.decision_context.agentguard_proposes}</div>
                </div>
              </div>
            )}

            {evidence.onchain && Object.keys(evidence.onchain).length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">On-Chain Records</p>
                <div className="text-xs bg-black/40 rounded p-3 space-y-1">
                  {evidence.onchain.interception && (
                    <div className="text-guard-safe">✓ Interception: {evidence.onchain.interception.recorded ? "Recorded" : "Pending"}</div>
                  )}
                  {evidence.onchain.rewrite && (
                    <div className="text-guard-safe">✓ Rewrite: {evidence.onchain.rewrite.recorded ? "Recorded" : "Pending"}</div>
                  )}
                  {evidence.onchain.decision && (
                    <div className="text-guard-safe">✓ Decision: {evidence.onchain.decision.recorded ? "Recorded" : "Pending"}</div>
                  )}
                </div>
              </div>
            )}

            {evidence.timestamp && (
              <div className="text-xs text-gray-500 pt-2 border-t border-guard-accent/20">
                Recorded: {new Date(evidence.timestamp).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuditLog() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null); // FIXED: Added state for evidence modal
  const [newIds, setNewIds] = useState([]);
  const seenIdsRef = useRef(new Set());

  useEffect(() => {
    const q = query(collection(db, "intercepts"), orderBy("created_at", "desc"), limit(50));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const incoming = snapshot.docs.map((doc) => ({ _id: doc.id, ...doc.data() }));
        const incomingIds = new Set(incoming.map((doc) => doc._id));

        if (seenIdsRef.current.size > 0) {
          const addedNow = incoming
            .map((doc) => doc._id)
            .filter((id) => !seenIdsRef.current.has(id));

          if (addedNow.length > 0) {
            setNewIds((prev) => Array.from(new Set([...prev, ...addedNow])));
            setTimeout(() => {
              setNewIds((prev) => prev.filter((id) => !addedNow.includes(id)));
            }, 4000);
          }
        }

        seenIdsRef.current = incomingIds;
        setRecords(incoming);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to subscribe audit log:", err);
        setError(err.message || "Failed to subscribe audit log");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  function formatTimestamp(record) {
    if (record?.created_at?.toDate) {
      return record.created_at.toDate().toLocaleString();
    }
    if (record?.created_at?.seconds) {
      return new Date(record.created_at.seconds * 1000).toLocaleString();
    }
    if (record?.timestamp) {
      return new Date(record.timestamp).toLocaleString();
    }
    return "N/A";
  }

  function statusColor(status) {
    switch (status) {
      case "approved":
        return "text-guard-safe bg-guard-safe/20 border border-guard-safe/50 shadow-lg shadow-guard-safe/20";
      case "rejected":
        return "text-guard-danger bg-guard-danger/20 border border-guard-danger/50 shadow-lg shadow-guard-danger/20";
      default:
        return "text-guard-warning bg-guard-warning/20 border border-guard-warning/50 shadow-lg shadow-guard-warning/20";
    }
  }

  function riskColor(level) {
    switch (level) {
      case "critical":
        return "text-guard-danger font-bold";
      case "high":
        return "text-guard-warning font-semibold";
      case "medium":
        return "text-guard-accent font-semibold";
      default:
        return "text-guard-safe font-semibold";
    }
  }

  function statusIcon(status) {
    switch (status) {
      case "approved":
        return "✅";
      case "rejected":
        return "🚫";
      default:
        return "⏳";
    }
  }

  if (loading) {
    return (
      <div className="text-center text-gray-400 py-12">
        <div className="inline-block">
          <span className="loading-dots"></span>
        </div>
        <p className="mt-3 text-guard-accent font-medium">Loading audit log...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-glow-cyan">📋 Audit Log</h2>
          <p className="text-xs text-gray-500 mt-1">{records.length} transaction(s) recorded</p>
        </div>
        <div className="text-xs text-guard-accent">Live via Firestore onSnapshot</div>
      </div>

      {/* FIXED: Show error message if load failed */}
      {error && (
        <div className="px-4 py-3 bg-guard-danger/10 border border-guard-danger/30 rounded-lg text-guard-danger text-sm">
          ❌ {error}
        </div>
      )}

      {records.length === 0 ? (
        <div className="text-center py-12 bg-gradient-to-br from-guard-card/50 to-guard-card/20 border border-guard-accent/20 rounded-xl animate-pulse-glow">
          <p className="text-gray-400 text-sm mb-2">📭 No transactions recorded yet</p>
          <p className="text-xs text-gray-500">Run a demo scenario to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record, idx) => {
            // FIXED: Added null safety for record properties
            const txId = record?._id;
            const status = record?.decision || record?.status || "pending";
            const riskLevel = record?.risk_level || record?.risk_report?.risk_level || "medium";
            const userIntent = record?.original_tx?.user_intent || record?.ai_tried || "Unknown intent";
            const funcName = record?.original_tx?.function_name || record?.tx_type || "unknown";
            const toAddr = record?.original_tx?.to_address || "unknown";
            const riskExplain = record?.why_risky || record?.llm_analysis?.risk_explanation || "";
            const isNew = txId && newIds.includes(txId);
            
            return (
              <div
                key={txId || idx}
                className={`card-glow group bg-guard-card border rounded-xl p-5 space-y-3 transition-all duration-500 animate-fade-in ${
                  isNew
                    ? "border-yellow-400 shadow-lg shadow-yellow-500/30"
                    : "border-guard-accent/20 hover:border-guard-accent/40"
                }`}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-xs text-gray-500 font-mono bg-guard-dark/30 px-2.5 py-1.5 rounded">
                    {formatTimestamp(record)}
                  </div>
                  <div className="flex items-center gap-2">
                    {isNew && (
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-400/40">
                        NEW
                      </span>
                    )}
                    <span
                      className={`text-xs font-bold px-2.5 py-1.5 rounded ${riskColor(riskLevel)}`}
                    >
                      ⚠️ {riskLevel.toUpperCase()}
                    </span>
                    <span
                      className={`text-xs font-bold px-3 py-1.5 rounded-full border ${statusColor(status)}`}
                    >
                      {statusIcon(status)} {status.toUpperCase()}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm text-gray-300">
                    <span className="text-guard-accent font-semibold">Intent:</span>{" "}
                    <span className="text-gray-300">
                      {userIntent}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                    🔧 {funcName}({toAddr.slice(0, 10)}...)
                  </div>
                </div>

                {/* FIXED: Added null safety for analysis snippet */}
                {riskExplain && (
                  <div className="text-xs text-gray-400 bg-black p-2.5 rounded border border-guard-accent/10 italic">
                    💭 "{riskExplain.slice(0, 80)}..."
                  </div>
                )}

                {/* FIXED: Added "View Evidence" button per record */}
                {txId && (
                  <button
                    onClick={() => setSelectedRecord(record)}
                    className="w-full mt-2 px-3 py-2 text-xs font-medium text-guard-accent border border-guard-accent/30 hover:border-guard-accent/60 hover:bg-guard-accent/10 rounded transition-all duration-300"
                  >
                    📦 View Evidence
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* FIXED: Added evidence modal */}
      {selectedRecord && (
        <EvidenceModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      )}
    </div>
  );
}
