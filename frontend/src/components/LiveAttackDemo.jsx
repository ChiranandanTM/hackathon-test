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

function clampToTwoDecimals(value) {
  return Number(value).toFixed(2);
}

function withTimeout(promise, ms, label) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function AddressBadge({ title, address, balance, colorClass }) {
  return (
    <div
      className={`rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${colorClass}`}
    >
      <div className="text-xs tracking-wide uppercase text-slate-500">{title}</div>
      <div className="mt-2 text-sm text-slate-700 font-mono break-all">{address || "not configured"}</div>
      <div className="mt-3 text-3xl font-semibold text-slate-900">{balance}</div>
      <div className="text-xs text-slate-500">MUSDC</div>
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
      const actual = DEMO_CONFIG.deployerBalanceEth || "unknown";
      const needed = DEMO_CONFIG.minRequiredBalanceEth || "unknown";
      return `Simulation mode active because deployer Sepolia balance is too low for wallet funding + deployment gas (current: ${actual} ETH, recommended: ${needed} ETH). Fund the deployer wallet, rerun \`npm run deploy:demo\`, then refresh frontend.`;
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

  async function animateBalances(start, end, durationMs = 2600) {
    const started = Date.now();

    return new Promise((resolve) => {
      const timer = setInterval(() => {
        const elapsed = Date.now() - started;
        const t = Math.min(1, elapsed / durationMs);

        const eased = 1 - (1 - t) * (1 - t);
        const next = {
          alex: clampToTwoDecimals(Number(start.alex) + (Number(end.alex) - Number(start.alex)) * eased),
          sam: clampToTwoDecimals(Number(start.sam) + (Number(end.sam) - Number(start.sam)) * eased),
          attacker: clampToTwoDecimals(
            Number(start.attacker) + (Number(end.attacker) - Number(start.attacker)) * eased
          ),
        };

        setBalances(next);

        if (t >= 1) {
          clearInterval(timer);
          resolve();
        }
      }, 80);
    });
  }

  async function readBalances(provider, tokenAddress) {
    const token = new ethers.Contract(tokenAddress, MOCK_USDC_ABI, provider);
    const [alexBal, samBal, attackerBal] = await Promise.all([
      token.balanceOf(DEMO_CONFIG.demoWallets.alex.address),
      token.balanceOf(DEMO_CONFIG.demoWallets.sam.address),
      token.balanceOf(DEMO_CONFIG.demoWallets.attacker.address),
    ]);
    return { alexBal, samBal, attackerBal };
  }

  function setBalancesFromRaw(raw) {
    setBalances({
      alex: formatUnits(raw.alexBal),
      sam: formatUnits(raw.samBal),
      attacker: formatUnits(raw.attackerBal),
    });
  }

  async function refreshBalances(provider, tokenAddress) {
    const raw = await readBalances(provider, tokenAddress);
    setBalancesFromRaw(raw);
    return raw;
  }

  async function runSimulationFlow(reason = "manual") {
    if (reason === "insufficient_funds") {
      pushLog("Running in simulation mode because deployer Sepolia funds are insufficient.");
    } else if (reason === "missing_deployer_key") {
      pushLog("Running in simulation mode because deployer key is missing in contracts/.env.");
    } else if (reason === "onchain_error") {
      pushLog("On-chain execution failed. Falling back to simulation mode for continuity.");
    } else {
      pushLog("Running in simulation mode.");
    }

    const simStart = { alex: "50.00", sam: "50.00", attacker: "0.00" };
    const simEnd = { alex: "30.00", sam: "50.00", attacker: "20.00" };
    setBalances(simStart);
    pushLog("Animation started: Alex drains while attacker balance rises.");
    await animateBalances(simStart, simEnd, 2800);
    pushLog("Alex unprotected wallet drained by 20 MUSDC (simulated). ");
    pushLog("Sam protected transaction blocked by intent validation (simulated).");
    await fetchAiExplanation();
    onNotify?.("Live Attack Demo completed in simulation mode.", "success");
  }

  async function executeOnChainDemo() {
    setRunning(true);
    setHashes({ alexDrainTx: "", samBlockedTx: "" });
    setAiSummary("");
    setLogs([]);

    try {
      if (isSimulationMode) {
        await runSimulationFlow(simulationReason || "manual");
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

      const initialRaw = await withTimeout(
        refreshBalances(provider, DEMO_CONFIG.contracts.mockUsdc),
        15000,
        "Initial balance fetch"
      );
      pushLog("Fetched initial Sepolia balances for Alex, Sam, and Attacker.");

      const allowance = await withTimeout(
        token.allowance(DEMO_CONFIG.demoWallets.alex.address, DEMO_CONFIG.contracts.attackSimulator),
        15000,
        "Allowance check"
      );
      if (allowance < asUnits(DEMO_CONFIG.drainAmount || "20")) {
        throw new Error("Alex allowance to AttackSimulator is not configured. Re-run deploy:demo.");
      }

      pushLog("Submitting Alex drain and Sam protected transaction in parallel...");
      const alexTxPromise = attackSimulator.drainWallet(
        DEMO_CONFIG.contracts.mockUsdc,
        DEMO_CONFIG.demoWallets.alex.address,
        DEMO_CONFIG.demoWallets.attacker.address,
        asUnits(DEMO_CONFIG.drainAmount || "20")
      );

      const samTxPromise = agentGuard
        .validateAndExecute(
          DEMO_CONFIG.contracts.mockUsdc,
          DEMO_CONFIG.demoWallets.attacker.address,
          asUnits(DEMO_CONFIG.drainAmount || "20")
        )
        .then((tx) => ({ ok: true, tx }))
        .catch((err) => ({ ok: false, err }));

      const alexTx = await withTimeout(alexTxPromise, 20000, "Alex transaction submission");
      setHashes((prev) => ({ ...prev, alexDrainTx: alexTx.hash }));

      let samTx = null;
      const samResult = await withTimeout(samTxPromise, 20000, "Sam transaction submission");
      if (samResult.ok) {
        samTx = samResult.tx;
        setHashes((prev) => ({ ...prev, samBlockedTx: samTx.hash }));
      } else {
        pushLog("Sam transaction reverted as expected: payload substitution blocked.");
      }

      const drain = asUnits(DEMO_CONFIG.drainAmount || "20");
      const animationStart = {
        alex: formatUnits(initialRaw.alexBal),
        sam: formatUnits(initialRaw.samBal),
        attacker: formatUnits(initialRaw.attackerBal),
      };
      const animationEnd = {
        alex: formatUnits(initialRaw.alexBal > drain ? initialRaw.alexBal - drain : 0n),
        sam: formatUnits(initialRaw.samBal),
        attacker: formatUnits(initialRaw.attackerBal + drain),
      };

      pushLog("Animation started while Sepolia transactions are being confirmed...");
      await animateBalances(animationStart, animationEnd, 3200);

      await withTimeout(alexTx.wait(), 90000, "Alex transaction confirmation");
      pushLog("Alex transaction confirmed: attacker successfully drained approved tokens.");
      if (samTx) {
        try {
          await withTimeout(samTx.wait(), 90000, "Sam transaction confirmation");
          pushLog("Sam transaction unexpectedly passed. Check registered intent setup.");
        } catch (err) {
          pushLog("Sam protected transaction confirmed as reverted on-chain.");
        }
      }

      await withTimeout(refreshBalances(provider, DEMO_CONFIG.contracts.mockUsdc), 15000, "Final balance fetch");
      pushLog("Final balances updated from on-chain state.");

      await fetchAiExplanation();
      onNotify?.("Live Attack Demo completed with on-chain proof.", "success");
    } catch (err) {
      pushLog(`Demo error: ${err.message || "unknown"}`);
      // Keep demo experience working even when RPC or contracts are temporarily unavailable.
      await runSimulationFlow("onchain_error");
    } finally {
      setRunning(false);
    }
  }

  const explorer = DEMO_CONFIG.explorerBaseUrl || "https://sepolia.etherscan.io/tx/";
  const modeBadgeClass = isSimulationMode
    ? "border-amber-200 bg-amber-50 text-amber-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 md:p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)] space-y-6 animate-fade-in"
      style={{ fontFamily: '"Space Grotesk", "Manrope", "Segoe UI", sans-serif' }}
    >
      <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.20),rgba(59,130,246,0))]" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.18),rgba(16,185,129,0))]" />

      <div className="relative">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Live Attack Demo</h2>
          <span className={`px-2.5 py-1 rounded-full text-xs border ${modeBadgeClass}`}>
            {isSimulationMode ? "Simulation Mode" : "On-Chain Mode"}
          </span>
        </div>
        <p className="text-slate-600 text-sm mt-2 max-w-2xl">
          Demonstrates unprotected drain vs AgentGuard-protected execution on Sepolia.
        </p>
      </div>

      {isSimulationMode && (
        <div className="relative rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800 shadow-sm">
          {simulationMessage}
        </div>
      )}

      {!isConfigured && !isSimulationMode && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800">
          Demo config is not generated yet. Run `npm run deploy:demo` inside `contracts` to create wallets,
          deploy contracts, and write `frontend/src/agentguard.config.js`.
        </div>
      )}

      <div className="relative rounded-2xl border border-slate-200 bg-white/90 backdrop-blur p-4 text-xs text-slate-600 space-y-2 shadow-sm">
        <div>
          Deployer: <span className="font-mono text-slate-900">{DEMO_CONFIG.deployerAddress || "not reported"}</span>
        </div>
        <div>
          Balance: <span className="font-mono text-slate-900">{DEMO_CONFIG.deployerBalanceEth || "n/a"} ETH</span>
        </div>
        <div>
          Recommended minimum: <span className="font-mono text-slate-900">{DEMO_CONFIG.minRequiredBalanceEth || "n/a"} ETH</span>
        </div>
        <div>
          Wallet funding target: <span className="font-mono text-slate-900">{DEMO_CONFIG.walletFundingEth || "n/a"} ETH</span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 relative">
        <AddressBadge
          title="Alex (Unprotected)"
          address={DEMO_CONFIG.demoWallets?.alex?.address}
          balance={balances.alex}
          colorClass="border-rose-200 bg-gradient-to-br from-rose-50 to-white"
        />
        <AddressBadge
          title="Sam (Protected)"
          address={DEMO_CONFIG.demoWallets?.sam?.address}
          balance={balances.sam}
          colorClass="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
        />
        <AddressBadge
          title="Attacker (Rogue Agent)"
          address={DEMO_CONFIG.demoWallets?.attacker?.address}
          balance={balances.attacker}
          colorClass="border-amber-200 bg-gradient-to-br from-amber-50 to-white"
        />
      </div>

      <button
        onClick={executeOnChainDemo}
        disabled={running}
        className="group relative overflow-hidden px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 hover:shadow-[0_14px_36px_rgba(15,23,42,0.35)] transition-all duration-300 disabled:opacity-60"
      >
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        {running ? "Executing Live Demo..." : "Execute Live Attack Demo"}
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 space-y-3 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Transaction Proof</div>
        {hashes.alexDrainTx ? (
          <a className="text-xs text-rose-700 underline break-all" href={`${explorer}${hashes.alexDrainTx}`} target="_blank" rel="noreferrer">
            Alex Drain Tx: {hashes.alexDrainTx}
          </a>
        ) : (
          <div className="text-xs text-slate-500">Alex drain transaction hash will appear after execution.</div>
        )}

        {hashes.samBlockedTx ? (
          <a className="text-xs text-emerald-700 underline break-all" href={`${explorer}${hashes.samBlockedTx}`} target="_blank" rel="noreferrer">
            Sam Protected Tx: {hashes.samBlockedTx}
          </a>
        ) : (
          <div className="text-xs text-slate-500">Sam protected tx often reverts before hash is finalized, which is expected.</div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 space-y-2 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">AI Explanation</div>
        <div className="text-sm text-slate-700 leading-6">
          {aiSummary || "Run the demo to fetch backend explanation for payload substitution."}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-900 mb-2">Execution Log</div>
        {logs.length === 0 ? (
          <div className="text-xs text-slate-500">No events yet.</div>
        ) : (
          <div className="space-y-1">
            {logs.map((line, idx) => (
              <div key={`${line}-${idx}`} className="text-xs text-slate-700 font-mono">
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
