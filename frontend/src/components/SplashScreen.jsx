import { useState } from "react";

export default function SplashScreen({ onDismiss }) {
  const [isVisible, setIsVisible] = useState(true);

  function handleDismiss() {
    setIsVisible(false);
    setTimeout(() => onDismiss?.(), 400);
  }

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center overflow-hidden"
      style={{
        animation: isVisible ? "fade-in 0.3s ease-out" : "fade-out 0.4s ease-out",
      }}
    >
      {/* Animated background - matrix style transaction stream */}
      <div className="absolute inset-0 opacity-20">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="absolute text-xs font-mono text-guard-accent/30 whitespace-nowrap overflow-hidden"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `matrix-fall ${3 + Math.random() * 3}s linear infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          >
            {["0x" + Math.random().toString(16).slice(2, 10), "$" + Math.floor(Math.random() * 999999), "TX", "AUDIT"][
              Math.floor(Math.random() * 4)
            ]}
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 text-center space-y-8 px-6 max-w-2xl">
        {/* Logo Animation */}
        <div className="mb-4 animate-bounce-gentle">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-guard-accent to-guard-purple mx-auto flex items-center justify-center font-bold text-3xl text-white shadow-2xl shadow-guard-accent/50">
            AG
          </div>
        </div>

        {/* Main Headline */}
        <div className="space-y-3">
          <h1
            className="text-5xl md:text-6xl font-bold text-white leading-tight"
            style={{
              animation: "slide-in-top 0.8s ease-out 0.2s both",
            }}
          >
            AI suggested it.
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-guard-accent via-guard-safe to-guard-purple">
              AgentGuard stopped it.
            </span>
          </h1>
          <p
            className="text-lg text-guard-accent/80 font-light tracking-wide"
            style={{
              animation: "slide-in-top 0.8s ease-out 0.4s both",
            }}
          >
            The only human-in-the-loop firewall for autonomous crypto agents.
          </p>
        </div>

        {/* Subtext */}
        <div
          className="text-sm text-gray-400 space-y-2"
          style={{
            animation: "fade-in 0.8s ease-out 0.6s both",
          }}
        >
          <p>🔐 Intercept risky transactions before they reach the blockchain</p>
          <p>🧠 Analyze with AI. Rewrite for safety. Enforce human approval.</p>
          <p>📋 Record every decision. Prove every action.</p>
        </div>

        {/* CTA Button */}
        <div
          style={{
            animation: "fade-in 0.8s ease-out 0.8s both",
          }}
        >
          <button
            onClick={handleDismiss}
            className="px-8 py-3 rounded-lg bg-gradient-to-r from-guard-accent to-guard-purple text-white font-semibold text-lg hover:shadow-xl hover:shadow-guard-accent/50 transition-all duration-300 hover:scale-105 active:scale-95"
          >
            Launch Demo →
          </button>
          <p className="text-xs text-gray-500 mt-4">Press ESC to skip</p>
        </div>
      </div>

      {/* Keyboard shortcut */}
      <style>{`
        @keyframes matrix-fall {
          0% {
            transform: translateY(-20px);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh);
            opacity: 0;
          }
        }
        @keyframes slide-in-top {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fade-out {
          to {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
