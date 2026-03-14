import { useEffect, useRef, useState } from "react";
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { approveTransaction, interceptTransaction, rejectTransaction } from "./utils/api";
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
import LiveAttackDemo from "./components/LiveAttackDemo";
import { db } from "./firebase";

export default function App() {
  const [role, setRole] = useState(() => localStorage.getItem("agentguard_role") || "user");
  const [wallet, setWallet] = useState(null);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState("live-attack");
  const [notification, setNotification] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const [threatQueue, setThreatQueue] = useState([]);
  const [threatDecisionLoading, setThreatDecisionLoading] = useState(false);
  const [manualThreatPrompt, setManualThreatPrompt] = useState(null);
  const [pendingUserTx, setPendingUserTx] = useState(null);
  const [sendTxLoading, setSendTxLoading] = useState(false);
  const [txDraft, setTxDraft] = useState({
    to: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    amount: "0.35",
    token: "ETH",
    user_intent: "Send money to friend",
  });
  const hasLoadedThreatStream = useRef(false);
  const lastThreatId = useRef("");
  const seenThreatIds = useRef(new Set());
  const dismissedThreatIds = useRef(new Set());
  const seenSimulationEventIds = useRef(new Set());
  const localClientId = useRef(
    (() => {
      const existing = localStorage.getItem("agentguard_client_id");
      if (existing) {
        return existing;
      }
      const created = `client_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem("agentguard_client_id", created);
      return created;
    })()
  );

  useEffect(() => {
    localStorage.setItem("agentguard_role", role);
  }, [role]);

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

  async function emitSimulationEvent(eventType, payload = {}) {
    try {
      await addDoc(collection(db, "simulation_events"), {
        type: eventType,
        source_role: role,
        source_client_id: localClientId.current,
        payload,
        created_at: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to emit simulation event:", error);
    }
  }

  async function handleUserTransactionSignal() {
    const amountNumber = Number(txDraft.amount);
    if (!txDraft.to || !Number.isFinite(amountNumber) || amountNumber <= 0) {
      showNotification("Enter a valid recipient and amount before sending.", "error");
      return;
    }

    const txPayload = {
      tx_type: "transfer",
      from_address: wallet?.address || "0xUSER_SIMULATED",
      to: txDraft.to,
      amount: String(txDraft.amount),
      token: txDraft.token || "ETH",
      initiated_by: "user",
      attack_simulation: false,
      user_intent: txDraft.user_intent || "Send money",
      wallet_balance: 5000,
    };

    setSendTxLoading(true);
    try {
      // Create a real transaction intent in backend before attacker reacts.
      const response = await interceptTransaction(txPayload);
      const txId = response?.tx_id || `local_${Date.now()}`;
      const payload = {
        tx_id: txId,
        from: txPayload.from_address,
        to: txPayload.to,
        amount: txPayload.amount,
        token: txPayload.token,
        user_intent: txPayload.user_intent,
      };

      setPendingUserTx(payload);
      await emitSimulationEvent("user_transaction_started", payload);
      showNotification("Transaction sent. Attacker terminal can now target this transfer.", "success");
    } catch (error) {
      showNotification(`Transaction failed: ${error.message || "Unknown error"}`, "error");
    } finally {
      setSendTxLoading(false);
    }
  }

  async function handleAttackStarted(attackInfo) {
    await emitSimulationEvent("attacker_attack_started", {
      attack_type: attackInfo?.attackType || "unknown",
      stage: "attack_started",
      tx_id: attackInfo?.txId || null,
      risk_level: attackInfo?.riskLevel || "high",
      risk_score: attackInfo?.riskScore ?? "N/A",
      why_risky: attackInfo?.whyRisky || "This transaction looks dangerous.",
      agentguard_proposes: attackInfo?.safeProposal || "Use the safe rewritten transaction.",
    });
  }

  function _isPendingThreat(data) {
    const decision = data?.decision;
    const status = String(data?.status || "pending").toLowerCase();
    const riskLevel = String(data?.risk_level || data?.risk_report?.risk_level || "").toLowerCase();
    const isPending = !decision && status === "pending";
    const isDanger = riskLevel === "critical" || riskLevel === "high";
    return isPending && isDanger;
  }

  function dismissThreatPopup(txId) {
    if (txId) {
      dismissedThreatIds.current.add(txId);
      setThreatQueue((prev) => prev.filter((item) => item.tx_id !== txId));
    }
    setManualThreatPrompt(null);
  }

  async function handleRealtimeDecision(action, txId) {
    if (!txId || threatDecisionLoading) {
      return;
    }
    setThreatDecisionLoading(true);
    try {
      if (action === "approve") {
        await approveTransaction(txId);
        showNotification("Approved the safe version. Your funds stay protected.", "success");
      } else {
        await rejectTransaction(txId, "User rejected after realtime threat alert");
        showNotification("Blocked the risky transaction.", "error");
      }

      // Close modal immediately and avoid re-opening from a stale pending snapshot.
        dismissThreatPopup(txId);
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

      if ((riskLevel === "critical" || riskLevel === "high") && role === "user") {
        showNotification(
          `Realtime alert: ${riskLevel.toUpperCase()} threat intercepted (${data.attack_type || "unknown"})`,
          "error"
        );
      }
    });

    return () => unsubscribe();
  }, [role]);

  useEffect(() => {
    const simulationQuery = query(
      collection(db, "simulation_events"),
      orderBy("created_at", "desc"),
      limit(40)
    );

    const unsubscribe = onSnapshot(simulationQuery, (snapshot) => {
      for (const doc of snapshot.docs) {
        if (seenSimulationEventIds.current.has(doc.id)) {
          continue;
        }
        seenSimulationEventIds.current.add(doc.id);

        const evt = doc.data() || {};
        if (evt.source_client_id === localClientId.current) {
          continue;
        }

        if (role === "attacker" && evt.type === "user_transaction_started") {
          const tx = evt.payload || {};
          setPendingUserTx(tx);
          setActiveTab("live-attack");
          showNotification(
            `User sent ${tx.amount || "?"} ${tx.token || "TOKEN"} to ${String(tx.to || "unknown").slice(0, 10)}...`,
            "error"
          );
        }

        if (role === "user" && evt.type === "attacker_attack_started") {
          setActiveTab("live-attack");
          const attack = evt.payload || {};
          const englishSummary = `Someone tried to tamper with your transfer. Review this alert and choose Approve Safe Rewrite or Reject.`;
          showNotification(englishSummary, "error");

          if (attack.tx_id) {
            setManualThreatPrompt({
              tx_id: attack.tx_id,
              attack_type: attack.attack_type || "tampering",
              risk_level: attack.risk_level || "high",
              risk_score: attack.risk_score ?? "N/A",
              why_risky:
                attack.why_risky ||
                "This transfer may send money to a malicious destination or allow token theft.",
              ai_tried: "Protect your transfer before confirmation.",
              agentguard_proposes:
                attack.agentguard_proposes ||
                "Approve the safe rewrite to continue securely, or reject to block this request.",
              initiated_by: "attacker",
            });
          }
        }
      }
    });

    return () => unsubscribe();
  }, [role]);

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
        }))
        .filter((item) => !dismissedThreatIds.current.has(item.tx_id));

      setThreatQueue(pendingThreats);

      if (manualThreatPrompt?.tx_id && pendingThreats.some((item) => item.tx_id === manualThreatPrompt.tx_id)) {
        setManualThreatPrompt(null);
      }

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

  return (
    <div className="min-h-screen bg-guard-dark">
      {/* Splash Screen */}
      {showSplash && <SplashScreen onDismiss={() => {
        setActiveTab("live-attack");
        setShowSplash(false);
      }} />}

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
          <div className="flex items-center gap-3">
            <WalletConnect onConnect={setWallet} />
          </div>
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
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-guard-card border border-guard-accent/20 rounded-lg p-1 w-fit mx-auto backdrop-blur-sm flex-wrap justify-center">
          {[
            { id: "live-attack", label: "Live Attack Demo" },
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
        {activeTab === "threat" && <ThreatVisualization result={result} />}

        {activeTab === "live-attack" && (
          <div className="space-y-8 animate-fade-in">
            <LiveAttackDemo />
            <section className="rounded-2xl border border-guard-accent/20 bg-black/40 p-4 md:p-6">
              <h3 className="text-lg font-semibold text-guard-accent mb-4">Simulation Attack</h3>
              <div className="space-y-6">
                <DemoScenarios
                  wallet={wallet}
                  onResult={handleResult}
                  onThreatDetected={handleThreatDetected}
                  onAttackStarted={handleAttackStarted}
                  actorRole={role}
                  pendingUserTx={pendingUserTx}
                  onClearTargetTx={() => setPendingUserTx(null)}
                />
                <TransactionComparison
                  result={result}
                  onAction={(action) => {
                    showNotification(
                      `Transaction ${action.action}: ${action.tx_id}`,
                      action.action === "approved" ? "success" : "error"
                    );
                  }}
                />
              </div>
            </section>
          </div>
        )}

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
