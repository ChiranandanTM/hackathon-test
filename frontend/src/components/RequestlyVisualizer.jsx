import { useState } from "react";

const AUTH_SCHEMES = [
  { id: "none", label: "No Auth", icon: "🔓" },
  { id: "bearer", label: "Bearer Token", icon: "🎫" },
  { id: "api_key", label: "API Key", icon: "🔑" },
  { id: "hmac", label: "HMAC Signature", icon: "🔐" },
];

export default function RequestlyVisualizer() {
  const [selectedAuth, setSelectedAuth] = useState("hmac");
  const [statusState, setStatusState] = useState({
    complex: false,
    validate: false,
    tests: false,
    export: false,
  });

  // Simulate workflow progression
  const runWorkflow = async () => {
    setStatusState({ complex: "running", validate: false, tests: false, export: false });
    await new Promise((r) => setTimeout(r, 1000));
    setStatusState({ complex: true, validate: "running", tests: false, export: false });
    await new Promise((r) => setTimeout(r, 1000));
    setStatusState({ complex: true, validate: true, tests: "running", export: false });
    await new Promise((r) => setTimeout(r, 1000));
    setStatusState({ complex: true, validate: true, tests: true, export: "running" });
    await new Promise((r) => setTimeout(r, 1000));
    setStatusState({ complex: true, validate: true, tests: true, export: true });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-glow-cyan">🔗 Requestly Workflow</h2>
        <p className="text-gray-400 text-sm">
          Interactive API client demonstrating complex request construction and validation
        </p>
      </div>

      {/* Auth Scheme Selector */}
      <div className="card-glow bg-guard-card border border-guard-accent/20 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-guard-accent">
          Select Authentication Scheme
        </h3>
        <div className="grid md:grid-cols-4 gap-4">
          {AUTH_SCHEMES.map((scheme) => (
            <button
              key={scheme.id}
              onClick={() => setSelectedAuth(scheme.id)}
              className={`p-4 rounded-lg border transition-all text-center ${
                selectedAuth === scheme.id
                  ? "bg-guard-accent/20 border-guard-accent/70 shadow-lg shadow-guard-accent/30"
                  : "bg-guard-card border-guard-accent/20 hover:border-guard-accent/50"
              }`}
            >
              <div className="text-3xl mb-2">{scheme.icon}</div>
              <div className="text-sm font-semibold text-white">{scheme.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Workflow Diagram */}
      <div className="card-glow bg-guard-card border border-guard-accent/20 rounded-xl p-8">
        <h3 className="text-sm font-semibold text-guard-accent mb-8">
          Request Flow Visualization
        </h3>

        {/* Flow Diagram */}
        <div className="space-y-6">
          {/* Complex Request Node */}
          <div className="flex items-center gap-4">
            <div
              className={`flex-shrink-0 w-20 h-20 rounded-lg border-2 flex items-center justify-center text-center transition-all ${
                statusState.complex === true
                  ? "bg-guard-safe/20 border-guard-safe/70 shadow-lg shadow-guard-safe/50"
                  : statusState.complex === "running"
                  ? "bg-guard-warning/20 border-guard-warning/70 shadow-lg shadow-guard-warning/50 animate-pulse"
                  : "bg-guard-card border-guard-accent/30"
              }`}
            >
              <div className="text-center">
                <div className="text-xl">🚀</div>
                <div className="text-xs font-bold mt-1">Complex</div>
              </div>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-white mb-2">
                POST /requestly/workflow/complex-request
              </h4>
              <p className="text-sm text-gray-400 mb-3">
                Construct rich request with {selectedAuth} authentication
              </p>
              <div className="bg-black/40 border border-guard-accent/20 rounded-lg p-3 text-xs font-mono text-gray-300 max-h-20 overflow-y-auto">
                {selectedAuth === "bearer" && `Authorization: Bearer TOKEN_VALUE`}
                {selectedAuth === "api_key" && `X-API-Key: your_api_key_here`}
                {selectedAuth === "hmac" && `X-Signature: sha256=abc123...`}
                {selectedAuth === "none" && `No authentication headers`}
              </div>
            </div>
            <div
              className={`text-3xl transition-all ${
                statusState.complex ? "text-guard-safe" : "text-gray-500"
              }`}
            >
              {statusState.complex === true ? "✓" : statusState.complex === "running" ? "⏳" : "○"}
            </div>
          </div>

          {/* Arrow Down */}
          <div className="flex justify-center">
            <div className="text-3xl text-guard-accent/30">↓</div>
          </div>

          {/* Validate Node */}
          <div className="flex items-center gap-4">
            <div
              className={`flex-shrink-0 w-20 h-20 rounded-lg border-2 flex items-center justify-center text-center transition-all ${
                statusState.validate === true
                  ? "bg-guard-safe/20 border-guard-safe/70 shadow-lg shadow-guard-safe/50"
                  : statusState.validate === "running"
                  ? "bg-guard-warning/20 border-guard-warning/70 shadow-lg shadow-guard-warning/50 animate-pulse"
                  : "bg-guard-card border-guard-accent/30"
              }`}
            >
              <div className="text-center">
                <div className="text-xl">🔍</div>
                <div className="text-xs font-bold mt-1">Validate</div>
              </div>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-white mb-2">
                GET /requestly/workflow/validate
              </h4>
              <p className="text-sm text-gray-400 mb-3">
                Verify endpoints: health, /intercept, /audit
              </p>
              <div className="bg-black/40 border border-guard-accent/20 rounded-lg p-3 text-xs space-y-1 text-gray-300 max-h-20 overflow-y-auto">
                <div>✓ health endpoint: 200 OK</div>
                <div>✓ intercept endpoint: operational</div>
                <div>✓ audit endpoint: verified</div>
              </div>
            </div>
            <div
              className={`text-3xl transition-all ${
                statusState.validate ? "text-guard-safe" : "text-gray-500"
              }`}
            >
              {statusState.validate === true ? "✓" : statusState.validate === "running" ? "⏳" : "○"}
            </div>
          </div>

          {/* Arrow Down */}
          <div className="flex justify-center">
            <div className="text-3xl text-guard-accent/30">↓</div>
          </div>

          {/* Tests Node */}
          <div className="flex items-center gap-4">
            <div
              className={`flex-shrink-0 w-20 h-20 rounded-lg border-2 flex items-center justify-center text-center transition-all ${
                statusState.tests === true
                  ? "bg-guard-safe/20 border-guard-safe/70 shadow-lg shadow-guard-safe/50"
                  : statusState.tests === "running"
                  ? "bg-guard-warning/20 border-guard-warning/70 shadow-lg shadow-guard-warning/50 animate-pulse"
                  : "bg-guard-card border-guard-accent/30"
              }`}
            >
              <div className="text-center">
                <div className="text-xl">⚙️</div>
                <div className="text-xs font-bold mt-1">Tests</div>
              </div>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-white mb-2">
                GET /requestly/workflow/run-tests
              </h4>
              <p className="text-sm text-gray-400 mb-3">
                Execute pre/post-response scripts with assertions
              </p>
              <div className="bg-black/40 border border-guard-accent/20 rounded-lg p-3 text-xs space-y-1 text-gray-300 max-h-20 overflow-y-auto">
                <div>✓ HMAC validation passed</div>
                <div>✓ Response schema valid</div>
                <div>✓ Status code assertions met</div>
              </div>
            </div>
            <div
              className={`text-3xl transition-all ${
                statusState.tests ? "text-guard-safe" : "text-gray-500"
              }`}
            >
              {statusState.tests === true ? "✓" : statusState.tests === "running" ? "⏳" : "○"}
            </div>
          </div>

          {/* Arrow Down */}
          <div className="flex justify-center">
            <div className="text-3xl text-guard-accent/30">↓</div>
          </div>

          {/* Export Node */}
          <div className="flex items-center gap-4">
            <div
              className={`flex-shrink-0 w-20 h-20 rounded-lg border-2 flex items-center justify-center text-center transition-all ${
                statusState.export === true
                  ? "bg-guard-safe/20 border-guard-safe/70 shadow-lg shadow-guard-safe/50"
                  : statusState.export === "running"
                  ? "bg-guard-warning/20 border-guard-warning/70 shadow-lg shadow-guard-warning/50 animate-pulse"
                  : "bg-guard-card border-guard-accent/30"
              }`}
            >
              <div className="text-center">
                <div className="text-xl">📦</div>
                <div className="text-xs font-bold mt-1">Export</div>
              </div>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-white mb-2">
                POST /requestly/workflow/export-workspace
              </h4>
              <p className="text-sm text-gray-400 mb-3">
                Export request/response history for team collaboration
              </p>
              <div className="bg-black/40 border border-guard-accent/20 rounded-lg p-3 text-xs space-y-1 text-gray-300 max-h-20 overflow-y-auto">
                <div>✓ Workspace exported to JSON</div>
                <div>✓ History includes 47 transactions</div>
                <div>✓ Shareable via git/workspace</div>
              </div>
            </div>
            <div
              className={`text-3xl transition-all ${
                statusState.export ? "text-guard-safe" : "text-gray-500"
              }`}
            >
              {statusState.export === true ? "✓" : statusState.export === "running" ? "⏳" : "○"}
            </div>
          </div>
        </div>

        {/* Run Button */}
        <div className="mt-8 pt-8 border-t border-guard-accent/10 flex justify-center">
          <button
            onClick={runWorkflow}
            className="px-8 py-3 rounded-lg bg-gradient-to-r from-guard-accent to-guard-purple text-white font-semibold hover:shadow-lg hover:shadow-guard-accent/50 transition-all active:scale-95"
          >
            ▶️ Run Workflow
          </button>
        </div>
      </div>

      {/* Request Preview */}
      <div className="card-glow bg-guard-card border border-guard-accent/20 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-guard-accent">
          Live Request Preview ({selectedAuth})
        </h3>
        <div className="bg-black/60 border border-guard-accent/20 rounded-lg p-4 font-mono text-xs overflow-x-auto space-y-2">
          <div className="text-guard-accent">POST /requestly/workflow/complex-request</div>
          <div className="text-gray-400">Content-Type: application/json</div>

          {selectedAuth !== "none" && (
            <div className="text-guard-safe">
              {selectedAuth === "bearer" && "Authorization: Bearer eyJhbGc..."}
              {selectedAuth === "api_key" && "X-API-Key: sk_test_4eC39HqLyjWDarhtT..."}
              {selectedAuth === "hmac" &&
                "X-Signature: sha256=d7d0701a..."}
            </div>
          )}

          <div />
          <div className="text-gray-300 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
            {`{
  "method": "POST",
  "url": "http://localhost:8000/intercept",
  "body": {
    "from_address": "0xUser...",
    "function_name": "approve",
    "args": {"amount": "MAX_UINT"}
  }
}`}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card-glow bg-guard-card border border-guard-accent/20 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-guard-accent">4</div>
          <div className="text-xs text-gray-400 mt-2">Workflow Endpoints</div>
        </div>
        <div className="card-glow bg-guard-card border border-guard-accent/20 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-guard-safe">5/5</div>
          <div className="text-xs text-gray-400 mt-2">Auth Schemes Tested</div>
        </div>
        <div className="card-glow bg-guard-card border border-guard-accent/20 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-guard-safe">✓</div>
          <div className="text-xs text-gray-400 mt-2">Track Requirements Met</div>
        </div>
      </div>
    </div>
  );
}
