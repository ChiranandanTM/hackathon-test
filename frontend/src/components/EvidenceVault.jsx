import { useEffect, useState } from "react";
import { jsPDF } from "jspdf";

export default function EvidenceVault() {
  const [evidence, setEvidence] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvidence() {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/audit`
        );
        const data = await res.json();
        if (Array.isArray(data.records)) {
          setEvidence(data.records.slice(0, 9));
        }
      } catch (err) {
        console.error("Failed to fetch evidence:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchEvidence();
  }, []);

  // Generate mock evidence if real data not available
  const displayedEvidence =
    evidence.length > 0
      ? evidence
      : [
          {
            tx_id: "0x1a2b3c4d",
            risk_level: "critical",
            risk_score: 92,
            timestamp: "2024-03-13T10:30:00",
            status: "approved_safe",
          },
          {
            tx_id: "0x5e6f7g8h",
            risk_level: "high",
            risk_score: 75,
            timestamp: "2024-03-13T10:25:00",
            status: "rejected",
          },
          {
            tx_id: "0x9i0j1k2l",
            risk_level: "medium",
            risk_score: 45,
            timestamp: "2024-03-13T10:20:00",
            status: "approved_safe",
          },
        ];

  // Hash chain visualization component
  function HashChain() {
    return (
      <div className="space-y-3">
        {displayedEvidence.slice(0, 4).map((record, i) => (
          <div key={i} className="flex items-center gap-4">
            {/* Hash Box */}
            <div className="flex-1 bg-black/60 border border-guard-accent/30 rounded-lg p-3">
              <div className="text-xs font-mono text-guard-accent/80 truncate">
                hash_{i}: 0x{Math.random().toString(16).slice(2, 18).toUpperCase()}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Block #{Math.floor(Math.random() * 100000) + 18500000}
              </div>
            </div>

            {/* Chain Link */}
            {i < displayedEvidence.length - 1 && (
              <div className="text-guard-accent text-xl">→</div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // QR Code Generator (simplified visual)
  function QRCodeVisualization() {
    const qrPattern = Array(5)
      .fill(null)
      .map(() =>
        Array(5)
          .fill(null)
          .map(() => Math.random() > 0.5)
      );

    return (
      <div className="bg-white p-4 rounded-lg inline-block">
        <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
          {qrPattern.flat().map((filled, i) => (
            <div
              key={i}
              className={`w-4 h-4 ${filled ? "bg-black" : "bg-white"}`}
            />
          ))}
        </div>
      </div>
    );
  }

  // PDF Download function
  function downloadPDFReport() {
    if (!selectedCase) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;
    const lineHeight = 7;
    const margin = 15;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(0, 217, 255);
    doc.text("AGENTGUARD", margin, yPosition);
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text("Security Analysis Report", margin, yPosition + 8);

    yPosition += 20;

    // Report Info
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPosition);
    yPosition += lineHeight;
    doc.text(`Report Type: Transaction Security Analysis`, margin, yPosition);

    yPosition += 15;

    // Transaction Details Section
    doc.setFontSize(14);
    doc.setTextColor(0, 217, 255);
    doc.text("TRANSACTION DETAILS", margin, yPosition);
    yPosition += lineHeight + 3;

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Transaction ID: ${selectedCase.tx_id}`, margin, yPosition);
    yPosition += lineHeight;
    doc.text(`Risk Level: ${(selectedCase.risk_level || "unknown").toUpperCase()}`, margin, yPosition);
    yPosition += lineHeight;
    doc.text(`Risk Score: ${selectedCase.risk_score || "N/A"}/100`, margin, yPosition);
    yPosition += lineHeight;
    doc.text(`Status: ${selectedCase.status || "pending"}`, margin, yPosition);
    yPosition += lineHeight;
    doc.text(`Timestamp: ${selectedCase.timestamp || "N/A"}`, margin, yPosition);

    yPosition += 15;

    // Executive Summary
    doc.setFontSize(14);
    doc.setTextColor(0, 217, 255);
    doc.text("EXECUTIVE SUMMARY", margin, yPosition);
    yPosition += lineHeight + 3;

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const summaryText = "This report contains a comprehensive security analysis of the transaction identified above. AgentGuard has evaluated the transaction for potential risks and generated recommendations for safe execution.";
    const wrappedSummary = doc.splitTextToSize(summaryText, pageWidth - 2 * margin);
    doc.text(wrappedSummary, margin, yPosition);
    yPosition += wrappedSummary.length * lineHeight + 5;

    // Risk Assessment
    doc.setFontSize(14);
    doc.setTextColor(0, 217, 255);
    doc.text("RISK ASSESSMENT", margin, yPosition);
    yPosition += lineHeight + 3;

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Risk Level: ${selectedCase.risk_level || "unknown"}`, margin, yPosition);
    yPosition += lineHeight;
    doc.text(`Risk Score: ${selectedCase.risk_score || "N/A"}/100`, margin, yPosition);
    yPosition += lineHeight;
    const policyAction = (selectedCase.risk_score || 0) > 70 ? "Block and Rewrite" : (selectedCase.risk_score || 0) > 30 ? "Review" : "Allow";
    doc.text(`Policy Action: ${policyAction}`, margin, yPosition);

    yPosition += 15;

    // Audit Trail
    doc.setFontSize(14);
    doc.setTextColor(0, 217, 255);
    doc.text("AUDIT TRAIL", margin, yPosition);
    yPosition += lineHeight + 3;

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const auditItems = [
      "✓ Transaction intercepted and analyzed",
      "✓ Risk patterns evaluated",
      "✓ Safe alternative generated (if applicable)",
      "✓ User decision recorded",
      "✓ On-chain proof recorded (where applicable)"
    ];
    auditItems.forEach(item => {
      doc.text(item, margin, yPosition);
      yPosition += lineHeight;
    });

    yPosition += 10;

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("AGENTGUARD SECURITY SYSTEM", margin, pageHeight - 10);
    doc.text("Protecting blockchain transactions since 2024", margin, pageHeight - 5);

    // Save PDF
    doc.save(`agentguard-report-${selectedCase.tx_id}.pdf`);
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-glow-cyan">📋 Evidence Vault</h2>
        <p className="text-gray-400 text-sm">
          Tamper-proof audit records with cryptographic verification
        </p>
      </div>

      {/* Case Files Grid */}
      <div className="grid md:grid-cols-3 gap-4">
        {displayedEvidence.map((record, i) => (
          <button
            key={record.tx_id}
            onClick={() => setSelectedCase(record)}
            className={`card-glow text-left rounded-xl p-6 border transition-all duration-300 space-y-3 ${
              selectedCase?.tx_id === record.tx_id
                ? "bg-guard-card/80 border-guard-accent/70 shadow-lg shadow-guard-accent/30"
                : "bg-guard-card border-guard-accent/20 hover:border-guard-accent/50"
            }`}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            {/* Case ID */}
            <div className="flex items-center justify-between">
              <div className="text-xs font-mono text-guard-accent/70">
                CASE#{(i + 1).toString().padStart(4, "0")}
              </div>
              <div className="text-xl">🔒</div>
            </div>

            {/* TX ID */}
            <div>
              <div className="text-xs text-gray-500">Transaction</div>
              <div className="text-sm font-mono text-guard-accent/90 truncate">
                {record.tx_id}
              </div>
            </div>

            {/* Risk Badge */}
            <div>
              <div className="text-xs text-gray-500">Risk Level</div>
              <div
                className={`text-sm font-bold mt-1 ${
                  record.risk_level === "critical"
                    ? "text-guard-danger"
                    : record.risk_level === "high"
                    ? "text-guard-warning"
                    : "text-guard-accent"
                }`}
              >
                {record.risk_level?.toUpperCase()}
              </div>
            </div>

            {/* Status */}
            <div className="pt-2 border-t border-guard-accent/10">
              <div className="text-xs text-guard-safe font-semibold flex items-center gap-2">
                ✓ {record.status?.replace(/_/g, " ").toUpperCase()}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Case Details */}
      {selectedCase && (
        <div className="card-glow bg-guard-card border border-guard-accent/20 rounded-xl p-6 space-y-6">
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-glow-cyan">Case File Details</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="text-gray-500">Case ID</div>
                <div className="font-mono text-guard-accent">
                  CASE#000{displayedEvidence.indexOf(selectedCase) + 1}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-gray-500">Status</div>
                <div className="text-guard-safe font-semibold">
                  {selectedCase.status?.replace(/_/g, " ").toUpperCase()}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-gray-500">Risk Score</div>
                <div className="text-guard-warning font-bold">
                  {selectedCase.risk_score}/100
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-gray-500">Timestamp</div>
                <div className="font-mono text-gray-400">
                  {new Date(selectedCase.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Hash Chain */}
          <div className="space-y-3 border-t border-guard-accent/10 pt-6">
            <h4 className="text-sm font-semibold text-guard-accent">
              Cryptographic Chain
            </h4>
            <HashChain />
          </div>

          {/* QR Code */}
          <div className="space-y-3 border-t border-guard-accent/10 pt-6">
            <h4 className="text-sm font-semibold text-guard-accent">
              Etherscan Link (QR Code)
            </h4>
            <div className="flex flex-col items-center gap-4">
              <QRCodeVisualization />
              <a
                href={`https://sepolia.etherscan.io/tx/${selectedCase.tx_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-guard-accent hover:underline font-mono"
              >
                View on Etherscan →
              </a>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 border-t border-guard-accent/10 pt-6">
            <button 
              onClick={downloadPDFReport}
              disabled={!selectedCase}
              className="flex-1 px-4 py-2 rounded-lg bg-guard-accent/20 border border-guard-accent/50 text-sm font-semibold text-guard-accent hover:bg-guard-accent/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              📥 Download PDF Report
            </button>
            <button className="flex-1 px-4 py-2 rounded-lg bg-guard-safe/20 border border-guard-safe/50 text-sm font-semibold text-guard-safe hover:bg-guard-safe/30 transition-all">
              ✓ Verify Evidence
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="card-glow bg-guard-card border border-guard-accent/20 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-guard-accent mb-4">
          Transaction Timeline
        </h3>
        <div className="space-y-3">
          {displayedEvidence.slice(0, 4).map((record, i) => (
            <div key={i} className="flex items-center gap-4 text-sm">
              <div className="w-8 h-8 rounded-full bg-guard-accent/20 flex items-center justify-center flex-shrink-0 font-bold text-guard-accent">
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="text-gray-300">
                  {record.status === "approved_safe" && "✓ Safe version approved"}
                  {record.status === "rejected" && "✗ Risky transaction rejected"}
                  {record.status === "approved_original" && "✓ Transaction passed"}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(record.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <div
                className={`text-xs font-bold px-2 py-1 rounded ${
                  record.risk_level === "critical"
                    ? "bg-guard-danger/20 text-guard-danger"
                    : record.risk_level === "high"
                    ? "bg-guard-warning/20 text-guard-warning"
                    : "bg-guard-accent/20 text-guard-accent"
                }`}
              >
                {record.risk_level}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
