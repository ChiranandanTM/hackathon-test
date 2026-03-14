import { useState, useEffect } from "react";

// Circular Risk Gauge component
function RiskGauge({ score = 0 }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getGaugeColor = () => {
    if (score >= 80) return "#ff006e";
    if (score >= 60) return "#ffa500";
    if (score >= 40) return "#ffd700";
    return "#00ff88";
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="rgba(0, 217, 255, 0.1)"
            strokeWidth="4"
          />
          {/* Animated gauge */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={getGaugeColor()}
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: "stroke-dashoffset 0.8s ease-out, stroke 0.3s ease",
              filter: `drop-shadow(0 0 10px ${getGaugeColor()})`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-3xl font-bold text-white">{Math.round(score)}</div>
            <div className="text-xs text-gray-400">/ 100</div>
          </div>
        </div>
      </div>
      <div className="text-sm font-semibold text-center">
        <div className="text-gray-300">Risk Level</div>
        <div
          className={`text-xs font-bold uppercase mt-1 ${
            score >= 80
              ? "text-guard-danger"
              : score >= 60
              ? "text-guard-warning"
              : score >= 40
              ? "text-yellow-300"
              : "text-guard-safe"
          }`}
        >
          {score >= 80
            ? "🔴 CRITICAL"
            : score >= 60
            ? "🟠 HIGH"
            : score >= 40
            ? "🟡 MEDIUM"
            : "🟢 LOW"}
        </div>
      </div>
    </div>
  );
}

// Animated Radar
function ThreatRadar() {
  const [threats, setThreats] = useState([
    { id: 1, angle: 45, distance: 60 },
    { id: 2, angle: 120, distance: 40 },
    { id: 3, angle: 240, distance: 75 },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setThreats((prev) =>
        prev.map((t) => ({
          ...t,
          angle: (t.angle + Math.random() * 20 - 10 + 360) % 360,
          distance: Math.min(80, Math.max(20, t.distance + Math.random() * 20 - 10)),
        }))
      );
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-64 h-64 mx-auto">
      <svg className="w-full h-full" viewBox="0 0 200 200">
        {/* Concentric circles */}
        {[40, 80, 120, 160].map((r, i) => (
          <circle
            key={i}
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke="rgba(0, 217, 255, 0.1)"
            strokeWidth="1"
          />
        ))}

        {/* Radar lines */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const x2 = 100 + Math.cos(rad) * 160;
          const y2 = 100 + Math.sin(rad) * 160;
          return (
            <line
              key={`line-${angle}`}
              x1="100"
              y1="100"
              x2={x2}
              y2={y2}
              stroke="rgba(0, 217, 255, 0.05)"
              strokeWidth="1"
            />
          );
        })}

        {/* Animated scanning line */}
        <g style={{ animation: "rotate 4s linear infinite" }}>
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="20"
            stroke="rgba(0, 217, 255, 0.6)"
            strokeWidth="2"
            style={{
              filter: "drop-shadow(0 0 8px rgba(0, 217, 255, 0.8))",
            }}
          />
        </g>

        {/* Threat dots */}
        {threats.map((threat) => {
          const rad = (threat.angle * Math.PI) / 180;
          const scale = threat.distance / 80;
          const x = 100 + Math.cos(rad) * threat.distance;
          const y = 100 + Math.sin(rad) * threat.distance;

          // Pulse animation
          return (
            <g key={threat.id}>
              <circle
                cx={x}
                cy={y}
                r="6"
                fill="rgba(255, 0, 110, 0.8)"
                style={{
                  animation: "radar-pulse 1.5s ease-out infinite",
                  filter: "drop-shadow(0 0 6px rgba(255, 0, 110, 0.9))",
                }}
              />
              <circle
                cx={x}
                cy={y}
                r="6"
                fill="none"
                stroke="rgba(255, 0, 110, 0.6)"
                strokeWidth="1.5"
                style={{
                  animation: "radar-pulse-ring 1.5s ease-out infinite",
                }}
              />
            </g>
          );
        })}

        {/* Center dot */}
        <circle cx="100" cy="100" r="4" fill="rgba(0, 217, 255, 0.8)" />
      </svg>

      <style>{`
        @keyframes rotate {
          from { transform: rotate(0deg); transform-origin: 100px 100px; }
          to { transform: rotate(360deg); transform-origin: 100px 100px; }
        }
        @keyframes radar-pulse {
          0% { r: 6; opacity: 1; }
          100% { r: 12; opacity: 0; }
        }
        @keyframes radar-pulse-ring {
          0% { r: 6; opacity: 1; }
          100% { r: 14; opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// Transaction Feed
function TransactionFeed({ transactions = [] }) {
  const mockTxs = [
    { id: "0x1a2b", func: "approve", risk: "critical", time: "2s ago" },
    { id: "0x3c4d", func: "transfer", risk: "high", time: "5s ago" },
    { id: "0x5e6f", func: "mint", risk: "medium", time: "12s ago" },
  ];

  return (
    <div className="space-y-2 text-xs font-mono">
      {mockTxs.map((tx, i) => (
        <div
          key={tx.id}
          className="flex items-center justify-between bg-black/40 border border-guard-accent/20 rounded-lg p-3 hover:border-guard-accent/50 transition-all animate-slide-in"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="flex-1 space-y-1">
            <div className="text-guard-accent">{tx.id}</div>
            <div className="text-gray-500">{tx.func}</div>
          </div>
          <div className="text-right space-y-1">
            <div
              className={`text-xs font-bold px-2 py-1 rounded ${
                tx.risk === "critical"
                  ? "bg-guard-danger/20 text-guard-danger"
                  : tx.risk === "high"
                  ? "bg-guard-warning/20 text-guard-warning"
                  : "bg-guard-accent/20 text-guard-accent"
              }`}
            >
              {tx.risk}
            </div>
            <div className="text-gray-500">{tx.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Code Diff View
function CodeDiff({ originalCode, safeCode }) {
  const original = originalCode || 'approve(0xATTACKER, MAX_UINT)';
  const safe = safeCode || 'approve(0xATTACKER, 1000 USDC)';

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 text-xs font-mono">
        {/* Original */}
        <div className="bg-guard-danger/10 border border-guard-danger/30 rounded-lg p-4">
          <div className="text-guard-danger font-bold mb-2">⚠️ Original</div>
          <pre className="text-gray-300 whitespace-pre-wrap break-all overflow-hidden max-h-48">
            {original}
          </pre>
          <div className="text-xs text-guard-danger mt-2">→ Risky</div>
        </div>

        {/* Safe */}
        <div className="bg-guard-safe/10 border border-guard-safe/30 rounded-lg p-4">
          <div className="text-guard-safe font-bold mb-2">✓ Safe Version</div>
          <pre className="text-gray-300 whitespace-pre-wrap break-all overflow-hidden max-h-48">
            {safe}
          </pre>
          <div className="text-xs text-guard-safe mt-2">→ Protected</div>
        </div>
      </div>

      {/* Change Indicator */}
      <div className="bg-black/40 border border-guard-accent/20 rounded-lg p-3 flex items-center gap-3 text-xs text-gray-300">
        <span className="text-guard-danger">−</span>
        <span className="text-red-400">MAX_UINT256</span>
        <span className="text-gray-500">→</span>
        <span className="text-guard-accent">+</span>
        <span className="text-green-400">Limited Amount</span>
      </div>
    </div>
  );
}

export default function ThreatVisualization({ result }) {
  const resolvedRiskScoreRaw =
    result?.data?.risk_report?.risk_score ??
    result?.data?.risk_score ??
    result?.risk_report?.risk_score ??
    result?.risk_score ??
    0;
  const resolvedRiskScore = Number(resolvedRiskScoreRaw) || 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-glow-cyan">🛡️ Threat Detection Dashboard</h2>
        <p className="text-gray-400 text-sm">Real-time transaction monitoring and risk analysis</p>
      </div>

      {/* Main Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Left: Radar */}
        <div className="card-glow bg-guard-card border border-guard-accent/20 rounded-xl p-6 flex flex-col items-center">
          <h3 className="text-sm font-semibold text-guard-accent mb-4">Threat Radar</h3>
          <ThreatRadar />
        </div>

        {/* Center: Risk Gauge */}
        <div className="card-glow bg-guard-card border border-guard-accent/20 rounded-xl p-6 flex flex-col items-center">
          <h3 className="text-sm font-semibold text-guard-accent mb-4">Risk Analysis</h3>
          <RiskGauge score={resolvedRiskScore} />
        </div>

        {/* Right: Transaction Feed */}
        <div className="card-glow bg-guard-card border border-guard-accent/20 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-guard-accent mb-4">Live Feed</h3>
          <TransactionFeed />
        </div>
      </div>

      {/* Code Diff View */}
      <div className="card-glow bg-guard-card border border-guard-accent/20 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-guard-accent mb-4">Transaction Comparison</h3>
        <CodeDiff
          originalCode={
            result?.data?.original_tx
              ? `${result.data.original_tx.function_name}(${JSON.stringify(result.data.original_tx.args).slice(0, 50)}...)`
              : undefined
          }
          safeCode={
            result?.data?.safe_tx
              ? `${result.data.safe_tx.function_name}(${JSON.stringify(result.data.safe_tx.args).slice(0, 50)}...)`
              : undefined
          }
        />
      </div>
    </div>
  );
}
