// src/components/coreNative.jsx
import React, { useState, useEffect } from 'react';
import { styles } from '../utils/styles.jsx';
import { useRpcStatus } from "../utils/statusRpc";

export default function NativeExchangeHistory({ userAddress, isConnected }) {

  const rpcUp = useRpcStatus();
  const [exchangeRecords, setExchangeRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [metrics, setMetrics] = useState({
    totalDeposited: 0,
    totalLiquidated: 0,
    totalTransactions: 0
  });

  const formatAllocation = (valueBigIntStr, decimals = 18, precision = 4) => {
    if (!valueBigIntStr || valueBigIntStr === "0") return "0.0000";
    try {
      const padded = valueBigIntStr.padStart(decimals + 1, '0');
      const splitIdx = padded.length - decimals;
      const integerPart = Number(padded.slice(0, splitIdx)).toLocaleString();
      const fractionalPart = padded.slice(splitIdx, splitIdx + precision);
      return `${integerPart}.${fractionalPart}`;
    } catch {
      return "0.0000";
    }
  };

  const formatDate = (timestampSeconds) => {
    if (!timestampSeconds) return "N/A";
    const date = new Date(timestampSeconds * 1000);
    return date.toLocaleString([], { hour12: false });
  };

  useEffect(() => {
    const fetchHistoryLogs = async () => {
      if (!userAddress || !isConnected) {
        setExchangeRecords([]);
        setMetrics({ totalDeposited: 0, totalLiquidated: 0, totalTransactions: 0 });
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await window.electronAPI.getNativeExchangeHistory({ userAddress });

        if (!response || !response.success || !Array.isArray(response.records)) {
          throw new Error(response?.error || "Invalid response schema returned from node bridge.");
        }

        let cumulativeIn = 0n;
        let cumulativeOut = 0n;

        const processedRecords = response.records.map((rec) => {
        const rawIn = BigInt(rec.amountin);
        const rawOut = BigInt(rec.amountout);

        // Aggregate stats using your asymmetric gates
        if (rec.credit) cumulativeIn += rawIn;
        if (rec.refund) cumulativeOut += rawIn;

        // Dynamically resolve the active transaction clearing hash based on the flow path
        let activeHash = rec.purchaseTxHash;
        if (rec.refund && rec.refundHash !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
            activeHash = rec.refundHash;
        }

        // Dynamically resolve who executed/authorized this action
        const operator = rec.refund ? rec.refundSetter : rec.payoutSetter;

        // Inside your fetch loop .map() routine:
        return {
        index: rec.termIndex,
        timestamp: rec.timestamp,
        isIngress: rec.credit,
        isRefund: rec.refund,
        txHash: rec.refund ? rec.refundHash : rec.purchaseTxHash,
        operator: rec.refund ? rec.refundSetter : rec.payoutSetter,
        amountInStr: rec.amountin,
        amountOutStr: rec.amountout,
        exchangeRateStr: rec.exchangeRate
        };
        });

        setExchangeRecords(processedRecords);
        setMetrics({
          totalDeposited: parseFloat(formatAllocation(cumulativeIn.toString())),
          totalLiquidated: parseFloat(formatAllocation(cumulativeOut.toString())),
          totalTransactions: processedRecords.length
        });

      } catch (err) {
        console.error("Exchange history ledger compile failure:", err);
        setError(err.message || "Failed to load exchange history records.");
      } finally {
        setLoading(false);
      }
    };

    fetchHistoryLogs();
  }, [userAddress, isConnected]);

  return (
    <div style={styles.mainContent}>
      {/* GLOBAL SESSION STATUS BAR */}
      <div style={{ display: "flex", flexDirection: "column", width: "100%", boxSizing: "border-box" }}>
        
        {/* HEADER LAYER: Matched perfectly to the premium blueprint layout */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: "16px", marginBottom: "20px" }}>
          
          {/* Left Side: Clean Title */}
          <div>
            <h1 style={{ ...styles.label, color: "#ffffff", fontSize: "20px", fontWeight: "300", letterSpacing: "1px", margin: "0" }}>
              EXCHANGE HISTORY
            </h1>
            <p style={{ color: "#555", fontSize: "11px", letterSpacing: "0.5px", margin: 0 }}>
              REVIEW PAST GLOBAL DOLLAR PURCHASES & HISTORICAL EXCHANGE RECORDS
            </p>
          </div>
          
          {/* Right Side: Consolidated Status Bar with Wallet Telemetry */}
          <div style={{ ...styles.label, display: "flex", gap: "24px", fontSize: "11px", letterSpacing: "0.5px" }}>
            <div>
              <span style={{ color: "#444" }}>NETWORK: </span>
              <span style={{ color: rpcUp > 0 ? "#1c9c31bd" : "#ef4444" }}>
                {rpcUp > 0 ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
            <div>
              <span style={{ color: "#444" }}>STATUS: </span>
              {isConnected ? (
                <span style={{ color: "#1c9c31bd", fontWeight: "500" }}>CONNECTED</span>
              ) : (
                <span style={{ color: "#ef4444", fontWeight: "500" }}>DISCONNECTED</span>
              )}
            </div>
            <div>
              <span style={{ color: "#444" }}>ACTIVE WALLET: </span>
              <span style={{ color: isConnected && userAddress ? "#fff" : "#555" }}>
                {isConnected && userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`.toUpperCase() : "0XNONE"}
              </span>
            </div>
          </div>
        </div>

        {/* NEW ETCHED HORIZONTAL DIVIDER (Using your exact opacity weight) */}
        <div style={{ display: "flex", alignItems: "center", width: "100%", paddingTop: "20px", margin: "0 0 40px 0" }}>
          <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, rgba(255, 255, 255, 0.49) 0%, rgba(255,255,255,0.02) 80%, transparent 100%)" }} />
        </div>
      </div>

      {/* METRIC ANALYTICS CONTAINER ROW */}
      {isConnected && userAddress && !loading && (
        <div style={{ display: "flex", gap: "16px", marginBottom: "30px" }}>
          <div style={{ ...styles.sectionCard, flex: 1, padding: "16px", margin: 0 }}>
            <span style={{ ...styles.label, color: "#666", fontSize: "10px", letterSpacing: "1px", fontWeight: "lighter", display: "block", marginBottom: "6px" }}>TOTAL CONVERSION VOLUME</span>
            <hr style={styles.divider} />
            <b style={{ fontSize: "16px", fontWeight: "lighter", color: "#fff" }}>
              {metrics.totalTransactions} <span style={{ fontSize: "12px", color: "#555" }}>ENTRIES</span>
            </b>
          </div>
          <div style={{ ...styles.sectionCard, flex: 1, padding: "16px", margin: 0 }}>
            <span style={{ ...styles.label, color: "#666", fontSize: "10px", letterSpacing: "1px", fontWeight: "lighter", display: "block", marginBottom: "6px" }}>CUMULATIVE PURCHASES</span>
            <hr style={styles.divider} />
            <b style={{ fontSize: "16px", fontWeight: "lighter", color: "#fff" }}>
              {metrics.totalDeposited.toFixed(4)} <span style={{ fontSize: "12px", color: "#555" }}>ASSETS</span>
            </b>
          </div>
          <div style={{ ...styles.sectionCard, flex: 1, padding: "16px", margin: 0, border: "1px solid rgba(239, 68, 68, 0.15)" }}>
            <span style={{ ...styles.label, color: "#ef4444", fontSize: "10px", letterSpacing: "1px", fontWeight: "lighter", display: "block", marginBottom: "6px" }}>CUMULATIVE LIQUIDATIONS</span>
            <hr style={styles.divider} />
            <b style={{ fontSize: "16px", fontWeight: "light", color: "#ef4444" }}>
              {metrics.totalLiquidated.toFixed(4)} <span style={{ fontSize: "12px", color: "rgba(239,68,68,0.5)" }}>ASSETS</span>
            </b>
          </div>
        </div>
      )}

      {/* HISTORICAL LEDGER SHEET */}
      <div style={styles.sectionCard}>
        <h2 style={styles.sectionTitle}>Two-Way Conversion Settlements</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
            <tr style={{ borderBottom: "1px solid #161616", borderTop: "1px solid #161616" }}>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>TIMESTAMP</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>AMOUNT IN</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>AMOUNT OUT</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>RATE</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px", textAlign: "right" }}>TX TYPE</th>
            </tr>
            </thead>
            <tbody>
            {exchangeRecords.length === 0 ? (
                <tr>
                {/* Updated colSpan to 5 to perfectly match your 5 new headers */}
                <td colSpan="5" style={{ ...styles.label, padding: "30px 8px", color: "#444444", textAlign: "center", fontStyle: "italic" }}>
                    {loading ? "Decrypting contract history streams..." : "No conversion history entries found for this wallet address profile..."}
                </td>
                </tr>
            ) : (
                exchangeRecords.map((rec) => (
                <tr key={`exchange-row-${rec.index}-${rec.timestamp}`} style={{ borderBottom: "1px solid #111111" }}>
                    
                    {/* COLUMN 1: TIMESTAMP */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#aaaaaa" }}>
                    {formatDate(rec.timestamp)}
                    </td>

                    {/* COLUMN 2: AMOUNT IN */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#ffffff" }}>
                    {formatAllocation(rec.amountInStr)} 
                    <span style={{ fontSize: "10px", color: "#555", marginLeft: "4px" }}>
                        {rec.isIngress ? "Base" : "GBDo"}
                    </span>
                    </td>

                    {/* COLUMN 3: AMOUNT OUT */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#ffffff" }}>
                    {formatAllocation(rec.amountOutStr)}
                    <span style={{ fontSize: "10px", color: "#555", marginLeft: "4px" }}>
                        {rec.isIngress ? "GBDo" : "Base"}
                    </span>
                    </td>

                    {/* COLUMN 4: EXCHANGE RATE */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#888888" }}>
                    {formatAllocation(rec.exchangeRateStr || rec.exchangeRate)}
                    </td>

                    {/* COLUMN 5: TX TYPE (Based strictly on rec.refund condition) */}
                    <td style={{ ...styles.label, padding: "12px 8px", textAlign: "right" }}>
                    {!rec.isRefund ? (
                        <span style={{ ...styles.label, color: "#1d5c34", fontSize: "11px", fontWeight: "600", background: "rgba(29,92,52,0.1)", padding: "2px 6px", borderRadius: "3px" }}>
                        BUY IN
                        </span>
                    ) : (
                        <span style={{ ...styles.label, color: "#ef4444", fontSize: "11px", fontWeight: "600", background: "rgba(239,68,68,0.1)", padding: "2px 6px", borderRadius: "3px" }}>
                        LIQUIDATION
                        </span>
                    )}
                    {/* Optional smaller sub-text for context hash tracking inside the same block */}
                    <span style={{ display: "block", fontSize: "10px", color: "#444", marginTop: "2px" }}>
                        {rec.txHash && rec.txHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" 
                        ? `HASH: ${rec.txHash.slice(0, 6)}...${rec.txHash.slice(-4)}`
                        : "internal sync"}
                    </span>
                    </td>

                </tr>
                ))
            )}
            </tbody>
        </table>
        </div>
    </div>
  );
}