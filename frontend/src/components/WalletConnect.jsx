import { useState } from "react";
import { connectWallet } from "../utils/ethereum";

export default function WalletConnect({ onConnect }) {
  const [address, setAddress] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      const wallet = await connectWallet();
      setAddress(wallet.address);
      onConnect(wallet);
    } catch (err) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  }

  const hasMetaMask = typeof window !== "undefined" && Boolean(window.ethereum);

  return (
    <div className="flex items-center gap-4">
      {address ? (
        <div className="flex items-center gap-3 bg-gradient-to-r from-guard-accent/20 to-guard-purple/20 border border-guard-safe/50 rounded-lg px-4 py-2 backdrop-blur-sm animate-pulse-eth">
          <div className="w-2 h-2 rounded-full bg-guard-safe/80 animate-bounce-gentle"></div>
          <span className="text-sm text-guard-safe font-medium">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </div>
      ) : hasMetaMask ? (
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="btn-glow relative px-6 py-2 rounded-lg font-medium text-white bg-gradient-to-r from-guard-accent to-guard-purple hover:shadow-lg hover:shadow-guard-accent/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
        >
          {connecting && <span className="inline-block mr-2">
            <span className="loading-dots"></span>
          </span>}
          {connecting ? "Connecting..." : "🔗 Connect MetaMask"}
        </button>
      ) : (
        <div className="flex items-center gap-2 bg-gradient-to-r from-guard-warning/20 to-guard-danger/20 border border-guard-warning/30 rounded-lg px-4 py-2 backdrop-blur-sm">
          <div className="w-2 h-2 rounded-full bg-guard-warning animate-pulse-glow"></div>
          <span className="text-sm text-guard-warning font-medium">Demo Mode (Dev)</span>
        </div>
      )}
      {error && (
        <span className="text-guard-danger text-sm font-medium animate-slide-in">
          ✕ {error}
        </span>
      )}
    </div>
  );
}
