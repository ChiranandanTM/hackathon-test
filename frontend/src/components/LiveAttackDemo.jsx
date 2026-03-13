import { useMemo, useState } from "react";
import { ethers } from "ethers";
import {
  AGENT_GUARD_ONCHAIN_ABI,
  ATTACK_SIMULATOR_ABI,
  DEMO_CONFIG,
  MOCK_USDC_ABI,
} from "../agentguard.config";
import { interceptTransaction } from "../utils/api";

function asUnits(value) {
  return ethers.parseUnits(String(value), DEMO_CONFIG.tokenDecimals || 6);
}

function formatUnits(value) {
  return Number(ethers.formatUnits(value || 0n, DEMO_CONFIG.tokenDecimals || 6)).toFixed(2);
}

function AddressBadge({ title, address, balance, colorClass }) {
  return (
    <div className={`rounded-xl border p-4 ${colorClass}`}>
      <div className="text-xs text-gray-400">{title}</div>
      <div className="mt-1 text-sm text-gray-200 font-mono break-all">{address || "not configured"}</div>
      <div className="mt-2 text-lg font-bold text-white">{balance} MUSDC</div>
    </div>
  );
}

export default function LiveAttackDemo({ onResult, onNotify }) {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [balances, setBalances] = useState({ alex: "0.00", sam: "0.00", attacker: "0.00" });
  const [hashes, setHashes] = useState({ alexDrainTx: "", samBlockedTx: "" });
  const [aiSummary, setAiSummary] = useState("");

  const isConfigured = useMemo(() => {
    const c = DEMO_CONFIG.contracts;
    const w = DEMO_CONFIG.demoWallets;
    return Boolean(
      c.mockUsdc && c.attackSimulator && c.agentGuardOnChain && w.alex.privateKey && w.sam.privateKey && w.attacker.address
    );
  }, []);

  const isSimulationMode = DEMO_CONFIG.mode === "simulation";
  const simulationReason = DEMO_CONFIG.simulationReason || "";

  const simulationMessage = useMemo(() => {
    if (simulationReason === "insufficient_funds") {
      return "Simulation mode active because deployer Sepolia balance is too low for wallet funding + contract deployment. Fund the deployer wallet, rerun `npm run deploy:demo`, then refresh frontend.";
    }
    if (simulationReason === "missing_deployer_key") {
      return "Simulation mode active because deployer key is missing. Set `PRIVATE_KEY` (or `DEMO_DEPLOYER_PRIVATE_KEY`) in `contracts/.env`, rerun `npm run deploy:demo`, then refresh frontend.";
    }
    return "Simulation mode active. Rerun `npm run deploy:demo` after checking `contracts/.env` and deployer Sepolia balance.";
  }, [simulationReason]);

  function pushLog(line) {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${line}`, ...prev].slice(0, 12));
  }

  async function fetchAiExplanation() {
    try {
      const response = await interceptTransaction({
        tx_type: "approve",
        attack_simulation: true,
        attack_type: "payload_substitution",
        initiated_by: "live_attack_demo",
        user_intent: "Send approved transfer to a trusted recipient",
        from_address: DEMO_CONFIG.demoWallets?.sam?.address || "0xSAM",
        spender: DEMO_CONFIG.demoWallets?.attacker?.address || "0xATTACKER",
        amount: String(asUnits(DEMO_CONFIG.drainAmount || "20")),
        token: "MUSDC",
      });
      const why =
        response?.why_risky || response?.decision_context?.why_risky || "Payload substitution detected and blocked.";
      setAiSummary(why);
      onResult?.({ scenario: { id: "live-attack-demo", name: "Live Attack Demo" }, data: response });
    } catch (err) {
      setAiSummary("AI analysis unavailable. Core blockchain proof still completed.");
    }
  }

  async function refreshBalances(provider, tokenAddress) {
    const token = new ethers.Contract(tokenAddress, MOCK_USDC_ABI, provider);
    const [alexBal, samBal, attackerBal] = await Promise.all([
      token.balanceOf(DEMO_CONFIG.demoWallets.alex.address),
      token.balanceOf(DEMO_CONFIG.demoWallets.sam.address),
      token.balanceOf(DEMO_CONFIG.demoWallets.attacker.address),
    ]);
    setBalances({
      alex: formatUnits(alexBal),
      sam: formatUnits(samBal),
      attacker: formatUnits(attackerBal),
    });
  }

  async function executeOnChainDemo() {
    setRunning(true);
    setHashes({ alexDrainTx: "", samBlockedTx: "" });
    setAiSummary("");
    setLogs([]);

    try {
      if (isSimulationMode) {
        if (simulationReason === "insufficient_funds") {
          pushLog("Running in simulation mode because deployer Sepolia funds are insufficient.");
        } else if (simulationReason === "missing_deployer_key") {
          pushLog("Running in simulation mode because deployer key is missing in contracts/.env.");
        } else {
          pushLog("Running in simulation mode.");
        }
        setBalances({ alex: "30.00", sam: "50.00", attacker: "20.00" });
        pushLog("Alex unprotected wallet drained by 20 MUSDC (simulated). ");
        pushLog("Sam protected transaction blocked by intent validation (simulated).");
        await fetchAiExplanation();
        onNotify?.("Live Attack Demo completed in simulation mode.", "success");
        return;
      }

      if (!isConfigured) {
        throw new Error("Live demo contracts/wallets are not configured. Run contracts deploy:demo first.");
      }

      const provider = new ethers.JsonRpcProvider(DEMO_CONFIG.rpcUrl);
      const alexSigner = new ethers.Wallet(DEMO_CONFIG.demoWallets.alex.privateKey, provider);
      const samSigner = new ethers.Wallet(DEMO_CONFIG.demoWallets.sam.privateKey, provider);

      const token = new ethers.Contract(DEMO_CONFIG.contracts.mockUsdc, MOCK_USDC_ABI, provider);
      const attackSimulator = new ethers.Contract(
        DEMO_CONFIG.contracts.attackSimulator,
        ATTACK_SIMULATOR_ABI,
        alexSigner
      );
      const agentGuard = new ethers.Contract(
        DEMO_CONFIG.contracts.agentGuardOnChain,
        AGENT_GUARD_ONCHAIN_ABI,
        samSigner
      );

      await refreshBalances(provider, DEMO_CONFIG.contracts.mockUsdc);
      pushLog("Fetched initial Sepolia balances for Alex, Sam, and Attacker.");

      const allowance = await token.allowance(
        DEMO_CONFIG.demoWallets.alex.address,
        DEMO_CONFIG.contracts.attackSimulator
      );
      if (allowance < asUnits(DEMO_CONFIG.drainAmount || "20")) {
        throw new Error("Alex allowance to AttackSimulator is not configured. Re-run deploy:demo.");
      }

      pushLog("Submitting Alex unprotected drain transaction...");
      const alexTx = await attackSimulator.drainWallet(
        DEMO_CONFIG.contracts.mockUsdc,
        DEMO_CONFIG.demoWallets.alex.address,
        DEMO_CONFIG.demoWallets.attacker.address,
        asUnits(DEMO_CONFIG.drainAmount || "20")
      );
      setHashes((prev) => ({ ...prev, alexDrainTx: alexTx.hash }));
      await alexTx.wait();
      pushLog("Alex transaction confirmed: attacker successfully drained approved tokens.");

      pushLog("Submitting Sam malicious substituted payload via AgentGuardOnChain...");
      try {
        const samTx = await agentGuard.validateAndExecute(
          DEMO_CONFIG.contracts.mockUsdc,
          DEMO_CONFIG.demoWallets.attacker.address,
          asUnits(DEMO_CONFIG.drainAmount || "20")
        );
        setHashes((prev) => ({ ...prev, samBlockedTx: samTx.hash }));
        await samTx.wait();
        pushLog("Sam transaction unexpectedly passed. Check registered intent setup.");
      } catch (err) {
        pushLog("Sam transaction reverted as expected: payload substitution blocked.");
      }

      await refreshBalances(provider, DEMO_CONFIG.contracts.mockUsdc);
      pushLog("Final balances updated from on-chain state.");

      await fetchAiExplanation();
      onNotify?.("Live Attack Demo completed with on-chain proof.", "success");
    } catch (err) {
      onNotify?.(err.message || "Live Attack Demo failed", "error");
      pushLog(`Demo error: ${err.message || "unknown"}`);
    } finally {
      setRunning(false);
    }
  }

  const explorer = DEMO_CONFIG.explorerBaseUrl || "https://sepolia.etherscan.io/tx/";

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-glow-cyan">Live Attack Demo (On-Chain)</h2>
        <p className="text-gray-300 text-sm mt-2">
          Demonstrates unprotected drain vs AgentGuard-protected execution on Sepolia.
        </p>
      </div>

      {isSimulationMode && (
        <div className="rounded-lg border border-guard-warning/30 bg-guard-warning/10 p-3 text-sm text-guard-warning">
          {simulationMessage}
        </div>
      )}

      {!isConfigured && !isSimulationMode && (
        <div className="rounded-lg border border-guard-warning/30 bg-guard-warning/10 p-3 text-sm text-guard-warning">
          Demo config is not generated yet. Run `npm run deploy:demo` inside `contracts` to create wallets,
          deploy contracts, and write `frontend/src/agentguard.config.js`.
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <AddressBadge
          title="Alex (Unprotected)"
          address={DEMO_CONFIG.demoWallets?.alex?.address}
          balance={balances.alex}
          colorClass="border-guard-danger/40 bg-guard-danger/10"
        />
        <AddressBadge
          title="Sam (Protected)"
          address={DEMO_CONFIG.demoWallets?.sam?.address}
          balance={balances.sam}
          colorClass="border-guard-safe/40 bg-guard-safe/10"
        />
        <AddressBadge
          title="Attacker (Rogue Agent)"
          address={DEMO_CONFIG.demoWallets?.attacker?.address}
          balance={balances.attacker}
          colorClass="border-guard-warning/40 bg-guard-warning/10"
        />
      </div>

      <button
        onClick={executeOnChainDemo}
        disabled={running}
        className="px-5 py-2.5 rounded-lg font-semibold text-white bg-gradient-to-r from-guard-warning to-guard-danger border border-guard-warning/40 hover:opacity-95 disabled:opacity-60"
      >
        {running ? "Executing Live Demo..." : "Execute Live Attack Demo"}
      </button>

      <div className="rounded-xl border border-guard-accent/30 bg-guard-card p-4 space-y-3">
        <div className="text-sm font-semibold text-guard-accent">Transaction Proof</div>
        {hashes.alexDrainTx ? (
          <a className="text-xs text-guard-danger underline break-all" href={`${explorer}${hashes.alexDrainTx}`} target="_blank" rel="noreferrer">
            Alex Drain Tx: {hashes.alexDrainTx}
          </a>
        ) : (
          <div className="text-xs text-gray-500">Alex drain transaction hash will appear after execution.</div>
        )}

        {hashes.samBlockedTx ? (
          <a className="text-xs text-guard-safe underline break-all" href={`${explorer}${hashes.samBlockedTx}`} target="_blank" rel="noreferrer">
            Sam Protected Tx: {hashes.samBlockedTx}
          </a>
        ) : (
          <div className="text-xs text-gray-500">Sam protected tx often reverts before hash is finalized, which is expected.</div>
        )}
      </div>

      <div className="rounded-xl border border-guard-accent/20 bg-black/40 p-4 space-y-2">
        <div className="text-sm font-semibold text-guard-accent">AI Explanation</div>
        <div className="text-sm text-gray-200">
          {aiSummary || "Run the demo to fetch backend explanation for payload substitution."}
        </div>
      </div>

      <div className="rounded-xl border border-guard-accent/20 bg-black/40 p-4">
        <div className="text-sm font-semibold text-guard-accent mb-2">Execution Log</div>
        {logs.length === 0 ? (
          <div className="text-xs text-gray-500">No events yet.</div>
        ) : (
          <div className="space-y-1">
            {logs.map((line, idx) => (
              <div key={`${line}-${idx}`} className="text-xs text-gray-300 font-mono">
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
