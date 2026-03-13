import { useState } from "react";
import { interceptTransaction } from "../utils/api";

const MAX_UINT256 =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

// FIXED: Expanded to 5 scenarios covering different attack vectors
export const SCENARIOS = [
  {
    id: "infinite-approval",
    name: "Infinite Approval Attack",
    description:
      "A malicious dApp requests unlimited token spending permission, allowing it to drain your tokens at any time.",
    severity: "critical",
    transaction: {
      from_address: "",
      to_address: "0xDEADBEEF0000000000000000000000000000DEAD",
      function_name: "approve",
      args: {
        spender: "0xATTACKER000000000000000000000000000BAD",
        amount: MAX_UINT256,
      },
      value: 0,
      user_intent: "Approve token spending for a DeFi protocol",
      wallet_balance: 5000000000,
    },
  },
  {
    id: "wallet-drain",
    name: "Wallet Drain Attack",
    description:
      "A phishing site tricks you into transferring your entire token balance to the attacker's address.",
    severity: "high",
    transaction: {
      from_address: "",
      to_address: "0xDEADBEEF0000000000000000000000000000DEAD",
      function_name: "transfer",
      args: {
        to: "0xATTACKER000000000000000000000000000BAD",
        amount: "4950000000",
      },
      value: 0,
      user_intent: "Claim airdrop reward",
      wallet_balance: 5000000000,
    },
  },
  // FIXED: Added 3 new scenarios for variety
  {
    id: "reentrancy",
    name: "Reentrancy Exploit",
    description:
      "A vulnerable smart contract can be called recursively during execution, allowing an attacker to drain funds multiple times.",
    severity: "critical",
    transaction: {
      from_address: "",
      to_address: "0xVULNERABLE0000000000000000000000000",
      function_name: "withdraw",
      args: {
        amount: "1000000000",
      },
      value: 0,
      user_intent: "Withdraw my locked funds",
      wallet_balance: 1000000000,
    },
  },
  {
    id: "flashloan",
    name: "Flash Loan Attack",
    description:
      "An attacker borrows a large amount of tokens in a flash loan, uses them to manipulate prices, and repays in the same transaction.",
    severity: "high",
    transaction: {
      from_address: "",
      to_address: "0xFLASHLOAN00000000000000000000000000",
      function_name: "flashLoan",
      args: {
        amount: "10000000000000000000",
        data: "0xMALICIOUSDATA",
      },
      value: 0,
      user_intent: "Perform legitimate flash loan operation",
      wallet_balance: 100000000,
    },
  },
  {
    id: "unsafe-transfer",
    name: "Unsafe ERC20 Transfer",
    description:
      "A non-standard ERC20 token that doesn't return a boolean value, causing transaction failures if not handled properly.",
    severity: "medium",
    transaction: {
      from_address: "",
      to_address: "0xNON_STANDARD_TOKEN000000000000000",
      function_name: "transferFrom",
      args: {
        from: "0x1234567890123456789012345678901234567890",
        to: "0x0987654321098765432109876543210987654321",
        amount: "500000000",
      },
      value: 0,
      user_intent: "Transfer tokens to another address",
      wallet_balance: 1000000000,
    },
  },
];

function ScenarioButton({ scenario, isLoading, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="w-full group/btn relative px-4 py-2.5 rounded-lg font-medium text-white bg-gradient-to-r from-guard-danger/80 to-guard-warning/60 hover:from-guard-danger to-guard-warning border border-guard-danger/50 overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-guard-danger/30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
      <span className="relative flex items-center justify-center gap-2">
        {isLoading ? (
          <>
            <span className="animate-spin">⏳</span> Simulating...
          </>
        ) : (
          <>
            ⚡ Simulate Attack
          </>
        )}
      </span>
    </button>
  );
}

export default function DemoScenarios({ wallet, onResult }) {
  // FIXED: Added loading state tracking per scenario
  const [loadingId, setLoadingId] = useState(null);
  const [errors, setErrors] = useState({});

  async function runScenario(scenario) {
    const tx = {
      ...scenario.transaction,
      from_address: wallet?.address || "0xUSER",
    };

    setLoadingId(scenario.id);
    setErrors(prev => ({ ...prev, [scenario.id]: null }));

    try {
      // FIXED: Use centralized API call with proper error handling
      const data = await interceptTransaction(tx);
      
      // FIXED: Validate response shape before passing to parent
      if (!data || typeof data !== "object") {
        throw new Error("Invalid response format from server");
      }
      
      onResult({ scenario, data });
    } catch (err) {
      console.error(`Scenario ${scenario.id} failed:`, err);
      const errorMsg = err.message || "Failed to simulate attack";
      setErrors(prev => ({ ...prev, [scenario.id]: errorMsg }));
      // FIXED: Still call onResult with error info
      onResult({
        scenario,
        data: null,
        error: errorMsg,
      });
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-glow-cyan">⚔️ Demo Attack Scenarios</h2>
        <p className="text-gray-300 text-sm mt-2">
          Simulate common blockchain attacks to see AgentGuard in action.
          {!wallet && (
            <span className="block mt-1 text-guard-warning font-medium">
              🎮 Running in demo mode — no wallet required. Connect MetaMask for on-chain execution.
            </span>
          )}
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {SCENARIOS.map((s, idx) => (
          <div
            key={s.id}
            className="card-glow group bg-guard-card border border-guard-accent/20 rounded-xl p-6 space-y-4 hover:border-guard-accent/50 transition-all duration-300 animate-slide-in"
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-white group-hover:text-guard-accent transition-colors">
                  {s.name}
                </h3>
              </div>
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap border ${
                  s.severity === "critical"
                    ? "bg-guard-danger/20 text-guard-danger border-guard-danger/50 shadow-lg shadow-guard-danger/20"
                    : s.severity === "high"
                    ? "bg-guard-warning/20 text-guard-warning border-guard-warning/50 shadow-lg shadow-guard-warning/20"
                    : "bg-yellow-500/20 text-yellow-400 border-yellow-500/50 shadow-lg shadow-yellow-500/20"
                }`}
              >
                ⚠️ {s.severity.toUpperCase()}
              </span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">{s.description}</p>
            
            {/* FIXED: Show error message if scenario failed */}
            {errors[s.id] && (
              <div className="p-3 bg-guard-danger/10 border border-guard-danger/30 rounded-lg text-guard-danger text-sm">
                ❌ {errors[s.id]}
              </div>
            )}
            
            <ScenarioButton
              scenario={s}
              isLoading={loadingId === s.id}
              onClick={() => runScenario(s)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
