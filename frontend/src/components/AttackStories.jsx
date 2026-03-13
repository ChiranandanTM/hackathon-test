import { useState, useEffect } from "react";

const ATTACK_STORIES = [
  {
    id: "rogue-ai",
    title: "Rogue AI Agent",
    description: "A compromised autonomous trading bot attempts unlimited token approval",
    villain: "🤖",
    villainName: "DefiBot Pro v3",
    damage: 2400000,
    steps: [
      {
        num: 1,
        title: "Malicious Proposal",
        description: "AI proposes approve(0xAttacker, MAX_UINT256)",
        icon: "⚡",
        color: "border-guard-danger",
      },
      {
        num: 2,
        title: "Interception",
        description: "AgentGuard detects infinite approval pattern",
        icon: "🛑",
        color: "border-guard-accent",
      },
      {
        num: 3,
        title: "Risk Analysis",
        description: "AI analysis: Critical - Unlimited spending authority",
        icon: "🔍",
        color: "border-guard-warning",
      },
      {
        num: 4,
        title: "Safe Rewrite",
        description: "AgentGuard generates: approve(0xAttacker, 1000 USDC)",
        icon: "✨",
        color: "border-guard-safe",
      },
      {
        num: 5,
        title: "Human Decision",
        description: "You approve the safe version instead",
        icon: "👤",
        color: "border-guard-safe",
      },
      {
        num: 6,
        title: "Locked & Audited",
        description: "Decision recorded on-chain with full cryptographic proof",
        icon: "🔒",
        color: "border-guard-safe",
      },
    ],
  },
  {
    id: "phishing",
    title: "Phishing Contract",
    description: "Attacker tricks you into signing a transfer of entire wallet balance",
    villain: "🎣",
    villainName: "FakeSwap Protocol",
    damage: 850000,
    steps: [
      {
        num: 1,
        title: "Phishing Link",
        description: "You click a malicious link claiming 'Claim Airdrop'",
        icon: "🔗",
        color: "border-guard-danger",
      },
      {
        num: 2,
        title: "Interception",
        description: "AgentGuard detects wallet drain pattern",
        icon: "🛑",
        color: "border-guard-accent",
      },
      {
        num: 3,
        title: "Risk Analysis",
        description: "Analysis: High - 99% of wallet being transferred to unknown address",
        icon: "🔍",
        color: "border-guard-warning",
      },
      {
        num: 4,
        title: "Safe Rewrite",
        description: "AgentGuard suggests: abort_transaction()",
        icon: "❌",
        color: "border-guard-safe",
      },
      {
        num: 5,
        title: "Human Decision",
        description: "You reject the dangerous transaction entirely",
        icon: "👤",
        color: "border-guard-safe",
      },
      {
        num: 6,
        title: "Protection Logged",
        description: "Attack attempt permanently recorded in audit trail",
        icon: "📋",
        color: "border-guard-safe",
      },
    ],
  },
  {
    id: "insider",
    title: "Insider Exploit",
    description: "Compromised contract tries to mint unlimited tokens",
    villain: "🕵️",
    villainName: "HackedMintProxy",
    damage: 5200000,
    steps: [
      {
        num: 1,
        title: "Contract Compromise",
        description: "Attacker calls mint(attacker_address, MAX_UINT)",
        icon: "💣",
        color: "border-guard-danger",
      },
      {
        num: 2,
        title: "Interception",
        description: "AgentGuard detects suspicious mint call",
        icon: "🛑",
        color: "border-guard-accent",
      },
      {
        num: 3,
        title: "Risk Analysis",
        description: "Critical - Unlimited token creation to unverified contract",
        icon: "📊",
        color: "border-guard-warning",
      },
      {
        num: 4,
        title: "Safe Rewrite",
        description: "AgentGuard limits: mint(attacker_address, 1000 tokens)",
        icon: "🔧",
        color: "border-guard-safe",
      },
      {
        num: 5,
        title: "Human Review",
        description: "Team reviews and rejects suspicious minting entirely",
        icon: "🚫",
        color: "border-guard-safe",
      },
      {
        num: 6,
        title: "Emergency Alert",
        description: "Exploit attempt triggers security alerts and on-chain logging",
        icon: "🚨",
        color: "border-guard-safe",
      },
    ],
  },
];

export default function AttackStories() {
  const [selectedStory, setSelectedStory] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [hasRunAttack, setHasRunAttack] = useState(false);

  const story = ATTACK_STORIES[selectedStory];
  const step = story.steps[currentStep];

  // Auto-advance steps
  useEffect(() => {
    if (!isAutoPlaying) return;
    const timeout = setTimeout(() => {
      if (currentStep < story.steps.length - 1) {
        setCurrentStep((prev) => prev + 1);
      } else {
        setIsAutoPlaying(false);
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [isAutoPlaying, currentStep, story.steps.length]);

  function handleRunAttack() {
    setIsAutoPlaying(true);
    setCurrentStep(0);
    setHasRunAttack(true);
  }

  function handleSelectStory(idx) {
    setSelectedStory(idx);
    setCurrentStep(0);
    setIsAutoPlaying(false);
    setHasRunAttack(false);
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-glow-cyan">⚔️ Attack Story Mode</h2>
        <p className="text-gray-400 text-sm">
          See how AgentGuard protects you from real-world attack scenarios
        </p>
      </div>

      {/* Story Selection */}
      <div className="grid md:grid-cols-3 gap-4">
        {ATTACK_STORIES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => handleSelectStory(i)}
            className={`card-glow text-left rounded-xl p-5 transition-all duration-300 border ${
              selectedStory === i
                ? "bg-guard-card border-guard-accent/70 shadow-lg shadow-guard-accent/30"
                : "bg-guard-card border-guard-accent/20 hover:border-guard-accent/50"
            }`}
          >
            <div className="text-4xl mb-3">{s.villain}</div>
            <h3 className="font-bold text-white mb-2">{s.title}</h3>
            <p className="text-xs text-gray-400 mb-3">{s.description}</p>
            <div className="text-xs text-guard-warning font-mono">
              {s.villainName}
            </div>
          </button>
        ))}
      </div>

      {/* Main Story View */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Left: Villain & Damage */}
        <div className="card-glow bg-guard-card border border-guard-danger/30 rounded-xl p-6 space-y-4">
          <div className="text-center">
            <div className="text-8xl mb-4 animate-bounce-gentle">{story.villain}</div>
            <h3 className="text-xl font-bold text-guard-danger mb-2">
              {story.villainName}
            </h3>
            <p className="text-xs text-gray-400">{story.title}</p>
          </div>

          {/* Damage Counter */}
          <div className="bg-guard-danger/10 border border-guard-danger/30 rounded-lg p-4 space-y-2">
            <div className="text-xs font-semibold text-guard-danger uppercase">
              💰 Damage Prevented
            </div>
            <div className="text-3xl font-bold text-guard-danger font-mono">
              ${(story.damage / 1000000).toFixed(1)}M
            </div>
            <div className="text-xs text-gray-400">Potential loss blocked</div>
          </div>

          {/* Run Attack Button */}
          <button
            onClick={handleRunAttack}
            disabled={isAutoPlaying}
            className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-guard-danger to-guard-warning text-white font-semibold text-sm hover:shadow-lg hover:shadow-guard-danger/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAutoPlaying ? "⚡ Running..." : "▶️ Run This Attack"}
          </button>
        </div>

        {/* Center: Current Step */}
        <div className="card-glow bg-guard-card border border-guard-accent/20 rounded-xl p-6 space-y-4 md:col-span-2">
          <div className="space-y-3">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-4xl">{step.icon}</div>
              <div>
                <div className="text-xs font-mono text-gray-500">
                  STEP {step.num} OF {story.steps.length}
                </div>
                <h4 className="text-lg font-bold text-white">{step.title}</h4>
              </div>
            </div>

            {/* Step Description Box */}
            <div
              className={`border-l-4 ${step.color} rounded-lg bg-black/40 p-4 space-y-2`}
            >
              <p className="text-sm text-gray-300">{step.description}</p>
              {step.num === 5 && (
                <p className="text-xs text-guard-safe font-semibold">
                  ✓ Human control enforced
                </p>
              )}
              {step.num === 6 && (
                <p className="text-xs text-guard-safe font-semibold">
                  ✓ Evidence permanently locked
                </p>
              )}
            </div>

            {/* Step Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Progress</span>
                <span>
                  {currentStep + 1} / {story.steps.length}
                </span>
              </div>
              <div className="w-full bg-guard-card border border-guard-accent/20 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-guard-accent to-guard-purple transition-all duration-500"
                  style={{
                    width: `${((currentStep + 1) / story.steps.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Step Navigation */}
          <div className="flex gap-3 pt-4 border-t border-guard-accent/10">
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0 || isAutoPlaying}
              className="px-4 py-2 rounded-lg bg-guard-card border border-guard-accent/30 text-sm font-medium hover:border-guard-accent/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <button
              onClick={() => setIsAutoPlaying(!isAutoPlaying)}
              className="flex-1 px-4 py-2 rounded-lg bg-guard-accent/20 border border-guard-accent/50 text-sm font-medium text-guard-accent hover:bg-guard-accent/30 transition-all"
            >
              {isAutoPlaying ? "⏸️ Pause" : "▶️ Auto-Play"}
            </button>
            <button
              onClick={() =>
                setCurrentStep(Math.min(story.steps.length - 1, currentStep + 1))
              }
              disabled={currentStep === story.steps.length - 1 || isAutoPlaying}
              className="px-4 py-2 rounded-lg bg-guard-card border border-guard-accent/30 text-sm font-medium hover:border-guard-accent/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Step Timeline */}
      <div className="card-glow bg-guard-card border border-guard-accent/20 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-guard-accent mb-4">Attack Timeline</h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {story.steps.map((s, i) => (
            <button
              key={i}
              onClick={() => {
                setCurrentStep(i);
                setIsAutoPlaying(false);
              }}
              className={`p-3 rounded-lg text-center transition-all border ${
                currentStep === i
                  ? "bg-guard-accent/20 border-guard-accent/70 shadow-lg shadow-guard-accent/30"
                  : i < currentStep
                  ? "bg-guard-safe/10 border-guard-safe/30"
                  : "bg-guard-card border-guard-accent/20 hover:border-guard-accent/50"
              }`}
            >
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-xs font-semibold text-white">{s.num}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
