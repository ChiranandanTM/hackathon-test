import { useState } from "react";
import WalletConnect from "./components/WalletConnect";
import DemoScenarios from "./components/DemoScenarios";
import LiveAttackDemo from "./components/LiveAttackDemo";
import TransactionComparison from "./components/TransactionComparison";
import AuditLog from "./components/AuditLog";
import SplashScreen from "./components/SplashScreen";
import ThreatVisualization from "./components/ThreatVisualization";
import AttackStories from "./components/AttackStories";
import EvidenceVault from "./components/EvidenceVault";
import MetricTerminal from "./components/MetricTerminal";
import RequestlyVisualizer from "./components/RequestlyVisualizer";

export default function App() {
  const [wallet, setWallet] = useState(null);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState("demo");
  const [notification, setNotification] = useState(null);
  const [showSplash, setShowSplash] = useState(true);

  function showNotification(msg, type = "info") {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  }

  function handleResult(res) {
    setResult(res);
    if (res?.error) {
      showNotification(`Error: ${res.error}`, "error");
    }
  }

  return (
    <div className="antigravity-theme min-h-screen bg-guard-dark">
      {showSplash && <SplashScreen onDismiss={() => setShowSplash(false)} />}

      {notification && (
        <div
          className={`ag-notification fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg animate-slide-in ${
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

      <header className="ag-lift border-b border-guard-accent/20 bg-guard-card/60 backdrop-blur-md sticky top-0 z-40 shadow-lg shadow-slate-200/70">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-guard-accent to-guard-purple flex items-center justify-center font-bold text-sm text-white shadow-lg shadow-sky-200/80 animate-pulse-eth">
              AG
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">AgentGuard</h1>
              <p className="text-xs text-slate-500">AI-Powered Blockchain Security</p>
            </div>
          </div>
          <WalletConnect onConnect={setWallet} />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div className="text-center space-y-3 py-4 animate-fade-in">
          <h2 className="ag-hero-title text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-guard-accent via-guard-safe to-guard-purple">
            Protect Your Wallet from Malicious Transactions
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            AgentGuard intercepts risky blockchain transactions, analyzes them with AI,
            and rewrites them into safer versions before they reach the chain.
          </p>
          {!wallet && (
            <p className="text-sm text-amber-700 max-w-xl mx-auto font-medium">
              No wallet connected. You can still run demo mode and view threat analysis.
            </p>
          )}
        </div>

        <div className="ag-tab-shell flex gap-1 bg-guard-card border border-guard-accent/20 rounded-lg p-1 w-fit mx-auto backdrop-blur-sm flex-wrap justify-center">
          {[
            { id: "demo", label: "Demo Scenarios" },
            { id: "live", label: "Live Attack Demo" },
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
              className={`ag-tab px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-guard-accent to-guard-purple text-white shadow-lg shadow-guard-accent/50"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "demo" && (
          <div className="space-y-8 animate-fade-in">
            <DemoScenarios wallet={wallet} onResult={handleResult} />
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
        )}

        {activeTab === "live" && (
          <LiveAttackDemo
            onResult={handleResult}
            onNotify={(msg, type) => showNotification(msg, type)}
          />
        )}

        {activeTab === "threat" && <ThreatVisualization result={result} />}
        {activeTab === "stories" && <AttackStories />}
        {activeTab === "evidence" && <EvidenceVault />}
        {activeTab === "scorecard" && <MetricTerminal />}
        {activeTab === "requestly" && <RequestlyVisualizer />}
        {activeTab === "audit" && <AuditLog />}
      </main>

      <footer className="border-t border-guard-accent/20 mt-12 py-6 text-center text-sm text-slate-500">
        <span className="text-emerald-600">+</span> AgentGuard - Ethereum Sepolia Testnet - Hackathon Demo
      </footer>
    </div>
  );
}
