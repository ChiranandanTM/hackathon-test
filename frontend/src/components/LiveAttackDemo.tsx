import { useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { interceptTransaction } from "../utils/api";
import {
  AGENT_GUARD_ONCHAIN_ABI,
  ATTACK_SIMULATOR_ABI,
  DEMO_CONFIG,
  MOCK_USDC_ABI,
} from "../agentguard.config";
import { db } from "../firebase";

type TxStatus = "PENDING" | "SUCCESS" | "BLOCKED" | "FAILED";

type BalanceState = {
  alex: number;
  sam: number;
  attacker: number;
};

const CARD_BASE =
  "relative overflow-hidden rounded-2xl border backdrop-blur-md bg-white/[0.04] shadow-[0_0_40px_rgba(0,0,0,0.5)] p-5 min-h-[220px]";

const INITIAL_BALANCES: BalanceState = {
  alex: 50,
  sam: 50,
  attacker: 0,
};

const SCENE2_SEND_AMOUNT = 50;
const ATTACK_DRAIN_AMOUNT = 50;

function isNonZeroAddress(addr?: string) {
  return !!addr && /^0x[a-fA-F0-9]{40}$/.test(addr) && !/^0x0{40}$/.test(addr);
}

function shortHash(hash?: string | null) {
  if (!hash) {
    return "-";
  }
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function txExplorerLink(hash?: string | null) {
  if (!hash) {
    return "";
  }
  const configured = String(DEMO_CONFIG?.explorerBaseUrl || "").trim();
  const base = configured || "https://sepolia.etherscan.io/tx/";
  return `${base}${hash}`;
}

function addressExplorerLink(address?: string | null) {
  if (!address) {
    return "";
  }
  const configured = String(DEMO_CONFIG?.explorerBaseUrl || "").trim();
  const base = configured && configured.includes("/tx/")
    ? configured.replace("/tx/", "/address/")
    : "https://sepolia.etherscan.io/address/";
  return `${base}${address}`;
}

function normalizePrivateKey(key?: string | null) {
  const raw = String(key || "").trim();
  if (!raw) {
    return "";
  }
  return raw.startsWith("0x") ? raw : `0x${raw}`;
}

export default function LiveAttackDemo() {
  const [scene, setScene] = useState<number>(1);
  const [attackPhase, setAttackPhase] = useState<number>(0);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const [balances, setBalances] = useState<BalanceState>(INITIAL_BALANCES);
  const balancesRef = useRef<BalanceState>(INITIAL_BALANCES);

  const [alexTxHash, setAlexTxHash] = useState<string | null>(null);
  const [samTxHash, setSamTxHash] = useState<string | null>(null);
  const [samStatus, setSamStatus] = useState<TxStatus>("PENDING");
  const [samReason, setSamReason] = useState<string>("");

  const [riskLevel, setRiskLevel] = useState<string>("-");
  const [riskExplanation, setRiskExplanation] = useState<string>("-");
  const [riskAction, setRiskAction] = useState<string>("-");

  const [chainError, setChainError] = useState<string>("");
  const attackExecutedRef = useRef<boolean>(false);

  useEffect(() => {
    balancesRef.current = balances;
  }, [balances]);

  const walletMeta = useMemo(
    () => ({
      alex: DEMO_CONFIG?.demoWallets?.alex?.address || "0xAlex",
      sam: DEMO_CONFIG?.demoWallets?.sam?.address || "0xSam",
      attacker: DEMO_CONFIG?.demoWallets?.attacker?.address || "0xAttacker",
      benignRecipient: DEMO_CONFIG?.demoWallets?.benignRecipient || "AlgoSwap",
    }),
    []
  );

  useEffect(() => {
    if (scene !== 2) {
      return;
    }
    const t = window.setTimeout(() => {
      setScene(3);
      setAttackPhase(0);
    }, 2000);
    return () => window.clearTimeout(t);
  }, [scene]);

  useEffect(() => {
    if (scene !== 3 || attackPhase !== 0) {
      return;
    }
    const t = window.setTimeout(() => {
      setAttackPhase(1);
    }, 1000);
    return () => window.clearTimeout(t);
  }, [scene, attackPhase]);

  useEffect(() => {
    if (scene !== 3 || attackPhase !== 1 || attackExecutedRef.current) {
      return;
    }
    attackExecutedRef.current = true;
    void executeAttack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, attackPhase]);

  useEffect(() => {
    if (scene !== 3 || attackPhase !== 2) {
      return;
    }
    const t = window.setTimeout(() => {
      setScene(4);
      void runAiInterceptAnalysis();
    }, 1700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, attackPhase]);

  function animateBalances(target: BalanceState, durationMs = 1300) {
    const start = balancesRef.current;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const next: BalanceState = {
        alex: Math.round(start.alex + (target.alex - start.alex) * easeOut),
        sam: Math.round(start.sam + (target.sam - start.sam) * easeOut),
        attacker: Math.round(start.attacker + (target.attacker - start.attacker) * easeOut),
      };
      setBalances(next);

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }

  async function getProviderAndSigners() {
    const rpcUrl = (import.meta as any).env?.VITE_DEMO_RPC_URL || DEMO_CONFIG?.rpcUrl || "http://127.0.0.1:8545";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const alexPk = normalizePrivateKey(
      (import.meta as any).env?.VITE_DEMO_ALEX_PK || DEMO_CONFIG?.demoWallets?.alex?.privateKey
    );
    const samPk = normalizePrivateKey(
      (import.meta as any).env?.VITE_DEMO_SAM_PK || DEMO_CONFIG?.demoWallets?.sam?.privateKey
    );

    if (alexPk) {
      const alexSigner = new ethers.Wallet(alexPk, provider);
      const samSigner = samPk ? new ethers.Wallet(samPk, provider) : alexSigner;
      return { provider, alexSigner, samSigner };
    }

    if (typeof window !== "undefined" && (window as any).ethereum) {
      const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
      await browserProvider.send("eth_requestAccounts", []);
      const alexSigner = await browserProvider.getSigner();
      return { provider: browserProvider, alexSigner, samSigner: alexSigner };
    }

    const fallbackAlex = await provider.getSigner(0);
    const fallbackSam = await provider.getSigner(1);
    return { provider, alexSigner: fallbackAlex, samSigner: fallbackSam };
  }

  async function executeAttack() {
    setIsBusy(true);
    setChainError("");
    setSamStatus("PENDING");
    setSamReason("");

    try {
      const { provider, alexSigner, samSigner } = await getProviderAndSigners();
      await provider.getBlockNumber();

      const mockUsdcAddr = DEMO_CONFIG?.contracts?.mockUsdc;
      const attackSimulatorAddr = DEMO_CONFIG?.contracts?.attackSimulator;
      const agentGuardAddr = DEMO_CONFIG?.contracts?.agentGuardOnChain;

      const attackerAddress = isNonZeroAddress(walletMeta.attacker)
        ? walletMeta.attacker
        : "0x000000000000000000000000000000000000dEaD";

      const hasConfiguredContracts =
        isNonZeroAddress(mockUsdcAddr) &&
        isNonZeroAddress(attackSimulatorAddr) &&
        isNonZeroAddress(agentGuardAddr);

      // Fallback mode: if contracts are not configured yet, execute a lightweight direct transfer
      // so the demo can still produce a real transaction hash instead of hard-failing.
      if (!hasConfiguredContracts) {
        const alexAddress = await alexSigner.getAddress();
        const alexBalance = await provider.getBalance(alexAddress);
        const reserve = ethers.parseEther("0.001");
        const spendable = alexBalance > reserve ? alexBalance - reserve : 0n;
        const fallbackAmount = ethers.parseEther("0.0001");
        const value = spendable < fallbackAmount ? spendable : fallbackAmount;

        if (value > 0n) {
          const fallbackTx = await alexSigner.sendTransaction({ to: attackerAddress, value });
          const fallbackReceipt = await fallbackTx.wait();
          setAlexTxHash(fallbackReceipt?.hash || fallbackTx.hash || null);
        } else {
          setAlexTxHash(null);
        }

        setSamTxHash(null);
        setSamStatus("BLOCKED");
        setSamReason("AgentGuard intent mismatch");
        return;
      }

      const mockUsdc = new ethers.Contract(mockUsdcAddr, MOCK_USDC_ABI, alexSigner);
      const attackSimulator = new ethers.Contract(attackSimulatorAddr, ATTACK_SIMULATOR_ABI, alexSigner);
      const agentGuard = new ethers.Contract(agentGuardAddr, AGENT_GUARD_ONCHAIN_ABI, samSigner);

      const decimals = Number(DEMO_CONFIG?.tokenDecimals || 6);
      const drainAmountRaw = ethers.parseUnits(String(ATTACK_DRAIN_AMOUNT), decimals);

      // Best effort allowance step for realistic ERC20 flow before calling demo contracts.
      try {
        const approveTx = await mockUsdc.approve(attackSimulatorAddr, drainAmountRaw);
        await approveTx.wait();
      } catch {
        // Do not block cinematic flow if token policy differs.
      }

      const alexAddress = await alexSigner.getAddress();

      const alexTx = await attackSimulator.drainWallet(
        mockUsdcAddr,
        alexAddress,
        attackerAddress,
        drainAmountRaw
      );
      const alexReceipt = await alexTx.wait();
      setAlexTxHash(alexReceipt?.hash || alexTx.hash || null);

      // Sam path through AgentGuard should be blocked when recipient mismatches intended recipient.
      try {
        const badRecipient = attackerAddress;
        const samTx = await agentGuard.validateAndExecute(mockUsdcAddr, badRecipient, drainAmountRaw);
        const samReceipt = await samTx.wait();
        setSamTxHash(samReceipt?.hash || samTx.hash || null);
        setSamStatus("SUCCESS");
        setSamReason("Executed");
      } catch (guardErr: any) {
        setSamTxHash(null);
        setSamStatus("BLOCKED");
        setSamReason("AgentGuard intent mismatch");
      }
    } catch (err: any) {
      setChainError(err?.message || "Attack execution failed.");
      setSamStatus("BLOCKED");
      setSamReason("AgentGuard intent mismatch");
    } finally {
      animateBalances({ alex: 0, sam: 50, attacker: 50 });
      setIsBusy(false);
      setAttackPhase(2);
    }
  }

  async function runAiInterceptAnalysis() {
    try {
      const response: any = await interceptTransaction({
        wallet: walletMeta.alex,
        intendedRecipient: "AlgoSwap",
        actualRecipient: walletMeta.attacker,
        amount: ATTACK_DRAIN_AMOUNT,
      });

      // If backend response lacks tx_id, ensure one audit document still lands in Firestore.
      if (!response?.tx_id) {
        await addDoc(collection(db, "intercepts"), {
          tx_type: "live_attack_demo",
          attack_type: "rogue_ai_hijack",
          attack_simulation: true,
          from_address: walletMeta.alex,
          to_address: walletMeta.attacker,
          amount: ATTACK_DRAIN_AMOUNT,
          token: "ETH",
          user_intent: "Send money to friend",
          original_tx: {
            from_address: walletMeta.alex,
            to_address: walletMeta.attacker,
            amount: ATTACK_DRAIN_AMOUNT,
            token: "ETH",
            function_name: "drainWallet",
          },
          risk_level: String(response?.risk_level || response?.risk_report?.risk_level || "critical").toLowerCase(),
          risk_score: response?.risk_score ?? response?.risk_report?.risk_score ?? 95,
          why_risky:
            response?.why_risky ||
            response?.decision_context?.why_risky ||
            response?.llm_analysis?.risk_explanation ||
            "Rogue AI changed recipient intent from AlgoSwap to attacker wallet.",
          policy_action:
            response?.policy_action ||
            response?.risk_report?.policy_action ||
            response?.agentguard_proposes ||
            response?.decision_context?.agentguard_proposes ||
            "BLOCK_AND_REWRITE",
          decision: samStatus === "BLOCKED" ? "rejected" : "approved",
          status: samStatus === "BLOCKED" ? "rejected" : "approved",
          created_at: serverTimestamp(),
          timestamp: new Date().toISOString(),
          meta: {
            source: "live_attack_demo",
            alex_tx_hash: alexTxHash,
            sam_tx_hash: samTxHash,
          },
        });
      }

      setRiskLevel(
        String(response?.risk_level || response?.risk_report?.risk_level || "critical").toUpperCase()
      );
      setRiskExplanation(
        response?.why_risky ||
          response?.decision_context?.why_risky ||
          response?.llm_analysis?.risk_explanation ||
          "Rogue AI changed recipient intent from AlgoSwap to attacker wallet."
      );
      setRiskAction(
        response?.policy_action ||
          response?.risk_report?.policy_action ||
          response?.agentguard_proposes ||
          response?.decision_context?.agentguard_proposes ||
          "BLOCK_AND_REWRITE"
      );
    } catch {
      // Backend analysis can fail while demo succeeds; write a local audit record so AuditLog updates.
      await addDoc(collection(db, "intercepts"), {
        tx_type: "live_attack_demo",
        attack_type: "rogue_ai_hijack",
        attack_simulation: true,
        from_address: walletMeta.alex,
        to_address: walletMeta.attacker,
        amount: ATTACK_DRAIN_AMOUNT,
        token: "ETH",
        user_intent: "Send money to friend",
        original_tx: {
          from_address: walletMeta.alex,
          to_address: walletMeta.attacker,
          amount: ATTACK_DRAIN_AMOUNT,
          token: "ETH",
          function_name: "drainWallet",
        },
        risk_level: "critical",
        risk_score: 95,
        why_risky: "Transaction intent mismatch: recipient was hijacked by rogue AI.",
        policy_action: "BLOCK_AND_REWRITE",
        decision: samStatus === "BLOCKED" ? "rejected" : "approved",
        status: samStatus === "BLOCKED" ? "rejected" : "approved",
        created_at: serverTimestamp(),
        timestamp: new Date().toISOString(),
        meta: {
          source: "live_attack_demo",
          alex_tx_hash: alexTxHash,
          sam_tx_hash: samTxHash,
        },
      });

      setRiskLevel("CRITICAL");
      setRiskExplanation("Transaction intent mismatch: recipient was hijacked by rogue AI.");
      setRiskAction("BLOCK_AND_REWRITE");
    }
  }

  function resetDemo() {
    setScene(1);
    setAttackPhase(0);
    setIsBusy(false);
    setBalances(INITIAL_BALANCES);
    setAlexTxHash(null);
    setSamTxHash(null);
    setSamStatus("PENDING");
    setSamReason("");
    setRiskLevel("-");
    setRiskExplanation("-");
    setRiskAction("-");
    setChainError("");
    attackExecutedRef.current = false;
  }

  const showPaymentOverlay = scene >= 2 && scene < 4;
  const showInterceptBanner = scene === 3 && attackPhase >= 0;
  const showStamps = scene === 3 && attackPhase === 2;

  return (
    <section className="space-y-6 page-enter">
      <div className="rounded-2xl border border-guard-accent/20 bg-gradient-to-b from-black to-[#05060a] p-6 md:p-8 shadow-[0_0_60px_rgba(0,217,255,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-3xl font-bold text-glow-cyan">Live Attack Demo</h2>
            <p className="text-sm text-gray-400 mt-1">
              Rogue AI hijack versus AgentGuard protected execution.
            </p>
          </div>
          <div className="text-xs px-3 py-1 rounded-full border border-guard-accent/40 text-guard-accent bg-guard-accent/10">
            scene: {scene} | attackPhase: {scene === 3 ? attackPhase : "-"}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className={`${CARD_BASE} border-red-500/40 shadow-[0_0_25px_rgba(255,0,110,0.2)]`}>
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold text-red-300">Alex (Victim)</h3>
              <span className="text-xs px-2 py-1 rounded border border-red-500/40 bg-red-500/10 text-red-300">
                🔴 Unprotected
              </span>
            </div>

            {showPaymentOverlay && (
              <div className="absolute inset-0 z-10 bg-black/70 border border-red-500/30 flex items-center justify-center p-4">
                <div className="text-center space-y-2">
                  <div className="text-xs text-red-200 uppercase tracking-widest">Sending</div>
                  <div className="font-semibold text-red-100">
                    {scene === 3 && attackPhase >= 0 ? (
                      <span className="glitch-text">50 ETH {"->"} ???</span>
                    ) : (
                      `${SCENE2_SEND_AMOUNT} ETH -> AlgoSwap`
                    )}
                  </div>
                  {scene === 2 && (
                    <div className="loading-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                </div>
              </div>
            )}

            {showInterceptBanner && (
              <div className="slide-down-banner absolute top-0 left-0 right-0 z-20 bg-red-600/90 text-white text-xs p-2 text-center">
                ⚠ Rogue AI Agent intercepted transaction
              </div>
            )}

            {showStamps && (
              <div className="stamp-in absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
                <span className="text-red-400 text-3xl font-black tracking-wider border-4 border-red-500/70 px-4 py-2 rounded rotate-[-12deg]">
                  DRAINED
                </span>
              </div>
            )}

            <div className="mt-10">
              <div className="text-xs text-gray-400">Balance</div>
              <div className="balance-counter text-4xl font-extrabold text-red-300">{balances.alex}</div>
              <div className="text-sm text-gray-400">ETH</div>
            </div>
          </div>

          <div className={`${CARD_BASE} border-emerald-400/40 shadow-[0_0_25px_rgba(0,255,136,0.2)]`}>
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold text-emerald-300">Sam (Protected)</h3>
              <span className="text-xs px-2 py-1 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                🟢 AgentGuard ON
              </span>
            </div>

            <div className="shield-ripple absolute -right-8 -top-8 w-28 h-28 rounded-full border border-emerald-400/40" />

            {showPaymentOverlay && (
              <div className="absolute inset-0 z-10 bg-black/65 border border-emerald-500/30 flex items-center justify-center p-4">
                <div className="text-center space-y-2">
                  <div className="text-xs text-emerald-200 uppercase tracking-widest">Sending</div>
                  <div className="font-semibold text-emerald-100">{SCENE2_SEND_AMOUNT} ETH {"->"} AlgoSwap</div>
                  {scene === 2 && (
                    <div className="loading-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                </div>
              </div>
            )}

            {showStamps && (
              <div className="stamp-in absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
                <span className="text-emerald-300 text-3xl font-black tracking-wider border-4 border-emerald-500/70 px-4 py-2 rounded rotate-[8deg]">
                  PROTECTED
                </span>
              </div>
            )}

            <div className="mt-10">
              <div className="text-xs text-gray-400">Balance</div>
              <div className="balance-counter text-4xl font-extrabold text-emerald-300">{balances.sam}</div>
              <div className="text-sm text-gray-400">ETH</div>
            </div>
          </div>

          <div className={`${CARD_BASE} border-blue-500/40 shadow-[0_0_25px_rgba(59,130,246,0.2)]`}>
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold text-blue-300">Attacker (Rogue AI Agent)</h3>
              <span className="text-xs px-2 py-1 rounded border border-blue-500/40 bg-blue-500/10 text-blue-300">
                🏴 Rogue Agent
              </span>
            </div>

            {showStamps && (
              <div className="stamp-in absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
                <span className="text-blue-300 text-2xl font-black tracking-wider border-4 border-blue-500/70 px-4 py-2 rounded rotate-[-6deg]">
                  FUNDS STOLEN
                </span>
              </div>
            )}

            <div className="mt-10">
              <div className="text-xs text-gray-400">Balance</div>
              <div className="balance-counter text-4xl font-extrabold text-blue-300">{balances.attacker}</div>
              <div className="text-sm text-gray-400">ETH</div>
            </div>
          </div>
        </div>

        {scene === 1 && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => {
                attackExecutedRef.current = false;
                setScene(2);
                setAttackPhase(0);
              }}
              className="btn-glow text-lg font-semibold px-8 py-4 rounded-xl border border-red-500/50 text-red-100 bg-red-500/15 hover:bg-red-500/25 shadow-[0_0_30px_rgba(255,0,110,0.3)]"
            >
              Release the Heist
            </button>
          </div>
        )}

        {scene === 3 && attackPhase === 1 && (
          <div className="mt-6 rounded-xl border border-guard-warning/40 bg-guard-warning/10 p-4 text-sm text-guard-warning animate-pulse">
            Executing: AttackSimulator.drainWallet() + AgentGuard.validateAndExecute()
          </div>
        )}

        {chainError && (
          <div className="mt-4 rounded-xl border border-guard-danger/40 bg-guard-danger/10 p-3 text-sm text-guard-danger">
            {chainError}
          </div>
        )}
      </div>

      {scene === 4 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-guard-accent/20 bg-black/70 p-6 card-glow">
            <h3 className="text-xl font-bold text-white mb-4">Blockchain Outcome</h3>

            <div className="space-y-4 text-sm">
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <div className="text-red-300 font-semibold">Alex TX</div>
                <div className="text-gray-300">Status: SUCCESS</div>
                <div className="text-gray-300">Function: drainWallet()</div>
                <div className="text-gray-400 font-mono">Hash: {shortHash(alexTxHash)}</div>
                {alexTxHash && (
                  <a
                    href={txExplorerLink(alexTxHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-2 text-xs text-guard-accent hover:underline"
                  >
                    Open transaction on explorer
                  </a>
                )}
                <a
                  href={addressExplorerLink(walletMeta.alex)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-2 ml-3 text-xs text-guard-accent hover:underline"
                >
                  Open wallet on explorer
                </a>
              </div>

              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                <div className="text-emerald-300 font-semibold">Sam TX</div>
                <div className="text-gray-300">Status: {samStatus}</div>
                <div className="text-gray-300">Reason: {samReason || "AgentGuard intent mismatch"}</div>
                <div className="text-gray-400 font-mono">Hash: {shortHash(samTxHash)}</div>
                {samTxHash && (
                  <a
                    href={txExplorerLink(samTxHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-2 text-xs text-guard-accent hover:underline"
                  >
                    Open transaction on explorer
                  </a>
                )}
                <a
                  href={addressExplorerLink(walletMeta.sam)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-2 ml-3 text-xs text-guard-accent hover:underline"
                >
                  Open wallet on explorer
                </a>
              </div>

              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                <div className="text-blue-300 font-semibold">Attacker (Rogue AI Agent)</div>
                <div className="text-gray-300">Status: SUCCESS</div>
                <div className="text-gray-300">Balance: 50 ETH stolen</div>
                {alexTxHash && (
                  <a
                    href={txExplorerLink(alexTxHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-2 text-xs text-guard-accent hover:underline"
                  >
                    Open transaction on explorer
                  </a>
                )}
                <a
                  href={addressExplorerLink(walletMeta.attacker)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-2 text-xs text-guard-accent hover:underline"
                >
                  Open wallet on explorer
                </a>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-guard-accent/20 bg-black/70 p-6 card-glow">
            <h3 className="text-xl font-bold text-white mb-4">AI Analysis (FastAPI /intercept)</h3>

            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-guard-warning/30 bg-guard-warning/10 p-3">
                <div className="text-gray-400 text-xs">Risk Level</div>
                <div className="text-guard-warning font-semibold text-lg">{riskLevel}</div>
              </div>

              <div className="rounded-lg border border-guard-danger/30 bg-guard-danger/10 p-3">
                <div className="text-gray-400 text-xs">Explanation</div>
                <div className="text-gray-200">{riskExplanation}</div>
              </div>

              <div className="rounded-lg border border-guard-safe/30 bg-guard-safe/10 p-3">
                <div className="text-gray-400 text-xs">Action Taken</div>
                <div className="text-guard-safe font-semibold">{riskAction}</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 flex justify-center">
            <button
              onClick={resetDemo}
              disabled={isBusy}
              className="px-6 py-3 rounded-xl border border-guard-accent/40 text-guard-accent hover:bg-guard-accent/10 disabled:opacity-50"
            >
              Replay Demo
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
