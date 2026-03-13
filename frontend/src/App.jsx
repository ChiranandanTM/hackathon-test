import { useEffect, useRef, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { approveTransaction, rejectTransaction } from "./utils/api";
import WalletConnect from "./components/WalletConnect";
import DemoScenarios from "./components/DemoScenarios";
import TransactionComparison from "./components/TransactionComparison";
import AuditLog from "./components/AuditLog";
import SplashScreen from "./components/SplashScreen";
import ThreatVisualization from "./components/ThreatVisualization";
import AttackStories from "./components/AttackStories";
import EvidenceVault from "./components/EvidenceVault";
import MetricTerminal from "./components/MetricTerminal";
import RequestlyVisualizer from "./components/RequestlyVisualizer";
import { db } from "./firebase";

export default function App() {
  const [wallet, setWallet] = useState(null);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState("demo");
  const [notification, setNotification] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const [threatQueue, setThreatQueue] = useState([]);
  const [threatDecisionLoading, setThreatDecisionLoading] = useState(false);
  const hasLoadedThreatStream = useRef(false);
  const lastThreatId = useRef("");
  const seenThreatIds = useRef(new Set());

  function showNotification(msg, type = "info") {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  }

  function handleResult(res) {
    setResult(res);
    if (res.error) {
      showNotification(`Error: ${res.error}`, "error");
    }
  }

  function handleAction(action) {
    showNotification(
      `Transaction ${action.action}: ${action.tx_id}`,
      action.action === "approved" ? "success" : "error"
    );
  }

  function handleThreatDetected(threat) {
    const reason = threat?.reason ? ` | ${String(threat.reason).slice(0, 90)}` : "";
    showNotification(
      `Threat detected ${String(threat?.riskLevel || "unknown").toUpperCase()} (${threat?.riskScore ?? "N/A"}) for ${threat?.attackType || "attack"}${reason}`,
      "error"
    );
  }

  function _isPendingThreat(data) {
    const decision = data?.decision;
    const status = String(data?.status || "pending").toLowerCase();
    const riskLevel = String(data?.risk_level || data?.risk_report?.risk_level || "").toLowerCase();
    const isPending = !decision && status === "pending";
    const isDanger = riskLevel === "critical" || riskLevel === "high";
    return isPending && isDanger;
  }

  async function handleRealtimeDecision(action, txId) {
    if (!txId || threatDecisionLoading) {
      return;
    }
    setThreatDecisionLoading(true);
    try {
      if (action === "approve") {
        await approveTransaction(txId);
        showNotification(`Threat ${txId} approved as safe rewrite`, "success");
      } else {
        await rejectTransaction(txId, "User rejected after realtime threat alert");
        showNotification(`Threat ${txId} rejected and blocked`, "error");
      }
      setThreatQueue((prev) => prev.filter((item) => item.tx_id !== txId));
    } catch (error) {
      showNotification(`Decision failed: ${error.message || "Unknown error"}`, "error");
    } finally {
      setThreatDecisionLoading(false);
    }
  }

  useEffect(() => {
    const threatQuery = query(collection(db, "intercepts"), orderBy("created_at", "desc"), limit(1));
    const unsubscribe = onSnapshot(threatQuery, (snapshot) => {
      if (snapshot.empty) {
        return;
      }

      const doc = snapshot.docs[0];
      const data = doc.data() || {};
      const riskLevel = String(data.risk_level || data?.risk_report?.risk_level || "").toLowerCase();

      if (!hasLoadedThreatStream.current) {
        hasLoadedThreatStream.current = true;
        lastThreatId.current = doc.id;
        return;
      }

      if (doc.id === lastThreatId.current) {
        return;
      }
      lastThreatId.current = doc.id;

      if (riskLevel === "critical" || riskLevel === "high") {
        showNotification(
          `Realtime alert: ${riskLevel.toUpperCase()} threat intercepted (${data.attack_type || "unknown"})`,
          "error"
        );
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const inboxQuery = query(collection(db, "intercepts"), orderBy("created_at", "desc"), limit(30));
    const unsubscribe = onSnapshot(inboxQuery, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({ _id: doc.id, ...doc.data() }));

      const pendingThreats = docs
        .filter((doc) => _isPendingThreat(doc))
        .map((doc) => ({
          tx_id: doc.tx_id || doc._id,
          attack_type: doc.attack_type || "unknown",
          risk_level: doc.risk_level || doc?.risk_report?.risk_level || "unknown",
          risk_score: doc.risk_score ?? doc?.risk_report?.risk_score ?? "N/A",
          why_risky: doc.why_risky || doc?.decision_context?.why_risky || "Threat details unavailable",
          ai_tried: doc.ai_tried || doc?.decision_context?.ai_tried || "Unknown intent",
          agentguard_proposes:
            doc.agentguard_proposes || doc?.decision_context?.agentguard_proposes || "Review manually",
          initiated_by: doc?.original_tx?.initiated_by || doc?.initiated_by || "unknown",
          created_at: doc.created_at,
        }));

      setThreatQueue(pendingThreats);

      for (const threat of pendingThreats) {
        if (!seenThreatIds.current.has(threat.tx_id)) {
          seenThreatIds.current.add(threat.tx_id);
          showNotification(
            `Incoming realtime threat: ${String(threat.risk_level).toUpperCase()} (${threat.attack_type})`,
            "error"
          );
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const activeThreat = threatQueue[0] || null;

  return (
    <div className="min-h-screen bg-guard-dark">
      {/* Splash Screen */}
      {showSplash && <SplashScreen onDismiss={() => setShowSplash(false)} />}

      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg animate-slide-in ${
            notification.type === "success"
              ? "bg-guard-safe/90 text-white border border-guard-safe/50"
              : notification.type === "error"
              ? "bg-guard-danger/90 text-white border border-guard-danger/50"
              : "bg-guard-accent/90 text-white border border-guard-accent/50"
          }`}
        >
          {notification.msg}
        </div>
      )}

      {activeThreat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl border border-guard-danger/40 bg-guard-card p-5 space-y-4 shadow-2xl shadow-guard-danger/20">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-guard-danger">Realtime Threat Detected</h3>
              <span className="text-xs px-2 py-1 rounded border border-guard-warning/40 text-guard-warning bg-guard-warning/10">
                LIVE MITM ALERT
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-guard-accent/20 bg-black/30 p-3">
                <div className="text-gray-400 text-xs">tx_id</div>
                <div className="text-gray-200 font-mono break-all">{activeThreat.tx_id}</div>
              </div>
              <div className="rounded-lg border border-guard-accent/20 bg-black/30 p-3">
                <div className="text-gray-400 text-xs">attack_type</div>
                <div className="text-guard-danger font-semibold">{String(activeThreat.attack_type).toUpperCase()}</div>
              </div>
              <div className="rounded-lg border border-guard-accent/20 bg-black/30 p-3">
                <div className="text-gray-400 text-xs">risk_level</div>
                <div className="text-guard-warning font-semibold">{String(activeThreat.risk_level).toUpperCase()}</div>
              </div>
              <div className="rounded-lg border border-guard-accent/20 bg-black/30 p-3">
                <div className="text-gray-400 text-xs">risk_score</div>
                <div className="text-guard-warning font-semibold">{String(activeThreat.risk_score)}</div>
              </div>
            </div>

            <div className="rounded-lg border border-guard-danger/30 bg-guard-danger/10 p-3 text-sm text-gray-200">
              <span className="text-guard-danger font-semibold">Attack Summary:</span> {activeThreat.why_risky}
            </div>

            <div className="rounded-lg border border-guard-safe/30 bg-guard-safe/10 p-3 text-sm text-gray-200">
              <span className="text-guard-safe font-semibold">AgentGuard Proposes:</span> {activeThreat.agentguard_proposes}
            </div>

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => handleRealtimeDecision("approve", activeThreat.tx_id)}
                disabled={threatDecisionLoading}
                className="px-4 py-2 rounded-lg border border-guard-safe/40 text-guard-safe hover:bg-guard-safe/10 disabled:opacity-60"
              >
                ✅ Accept Safe Rewrite
              </button>
              <button
                onClick={() => handleRealtimeDecision("reject", activeThreat.tx_id)}
                disabled={threatDecisionLoading}
                className="px-4 py-2 rounded-lg border border-guard-danger/40 text-guard-danger hover:bg-guard-danger/10 disabled:opacity-60"
              >
                ❌ Reject & Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-guard-accent/20 bg-guard-card/60 backdrop-blur-md sticky top-0 z-40 shadow-lg shadow-guard-accent/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-guard-accent to-guard-purple flex items-center justify-center font-bold text-sm text-white shadow-lg shadow-guard-accent/50 animate-pulse-eth">
              AG
            </div>
            <div>
              <h1 className="text-lg font-bold text-white text-glow-cyan">AgentGuard</h1>
              <p className="text-xs text-guard-safe/70">
                AI-Powered Blockchain Security
              </p>
            </div>
          </div>
          <WalletConnect onConnect={setWallet} />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3 py-4 animate-fade-in">
          <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-guard-accent via-guard-safe to-guard-purple">
            Protect Your Wallet from Malicious Transactions
          </h2>
          <p className="text-gray-300 max-w-2xl mx-auto">
            AgentGuard intercepts risky blockchain transactions, analyzes them
            with AI, and rewrites them into safer versions — before they reach
            the chain.
          </p>
          {!wallet && (
            <p className="text-sm text-guard-warning/80 max-w-xl mx-auto font-medium">
              ⚡ No wallet connected — running in demo mode. You can simulate attacks and view analysis without MetaMask.
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-guard-card border border-guard-accent/20 rounded-lg p-1 w-fit mx-auto backdrop-blur-sm flex-wrap justify-center">
          {[
            { id: "demo", label: "Demo Scenarios" },
            { id: "threat", label: "Threat Dashboard" },
            { id: "stories", label: "Attack Stories" },
            { id: "evidence", label: "Evidence Vault" },
            { id: "scorecard", label: "Judge Scorecard" },
            { id: "requestly", label: "Requestly Workflow" },
            { id: "audit", label: "Audit Log" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-guard-accent to-guard-purple text-white shadow-lg shadow-guard-accent/50"
                  : "text-gray-400 hover:text-guard-accent/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "demo" && (
          <div className="space-y-8 animate-fade-in">
            <DemoScenarios wallet={wallet} onResult={handleResult} onThreatDetected={handleThreatDetected} />
            <TransactionComparison result={result} onAction={(action) => {
              showNotification(
                `Transaction ${action.action}: ${action.tx_id}`,
                action.action === "approved" ? "success" : "error"
              );
            }} />
          </div>
        )}

        {activeTab === "threat" && <ThreatVisualization result={result} />}

        {activeTab === "stories" && <AttackStories />}

        {activeTab === "evidence" && <EvidenceVault />}

        {activeTab === "scorecard" && <MetricTerminal />}

        {activeTab === "requestly" && <RequestlyVisualizer />}

        {activeTab === "audit" && <AuditLog />}
      </main>

      {/* Footer */}
      <footer className="border-t border-guard-accent/20 mt-12 py-6 text-center text-sm text-gray-500">
        <span className="text-guard-safe">✓</span> AgentGuard &mdash; Ethereum Sepolia Testnet &mdash; Hackathon Demo
      </footer>
    </div>
  );
}
