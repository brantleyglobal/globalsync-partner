// src/components/AffiliatePortal.jsx
import React, { useState, useEffect } from 'react';
import { styles } from '../utils/styles.jsx';
import { deployments } from '../utils/tokensX.js';
import { useRpcStatus } from "../utils/statusRpc";

export default function AffiliatePortal({ userAddress, activeContract, affiliateTotal, isConnected }) {

  const rpcUp = useRpcStatus();
  const [referralRecords, setReferralRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [overviewTotal, setOverviewTotal] = useState("0 GBDo");
  
  const [totals, setTotals] = useState({
    totalEarned: 0,
    referralCount: 0
  });

  const formatAllocation = (valueBigInt, decimals = 18, precision = 4) => {
    if (!valueBigInt || valueBigInt === 0n) return "0.0000";
    const padded = valueBigInt.toString().padStart(decimals + 1, '0');
    const splitIdx = padded.length - decimals;
    const integerPart = Number(padded.slice(0, splitIdx)).toLocaleString();
    const fractionalPart = padded.slice(splitIdx, splitIdx + precision);
    return `${integerPart}.${fractionalPart}`;
  };

  useEffect(() => {
      if (totals.totalEarned) {
        setOverviewTotal(totals.totalEarned);
        affiliateTotal(overviewTotal);
      }
    }, [overviewTotal, affiliateTotal]);

  // Inside your frontend AffiliatePortal.jsx useEffect loop:
  useEffect(() => {
    const fetchAffiliateLogs = async () => {
      if (!userAddress || !isConnected) {
        setReferralRecords([]);
        setTotals({ totalEarned: 0, referralCount: 0 });
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let records = null;

        try {
          // Request data via your Electron IPC bridge handler
          records = await window.electronAPI.getAffiliateHistory({
            userAddress,
            contractAddress: deployments.AssetPurchase, 
            chainKey: "global" 
          });
        } catch (ipcError) {
          // Keep the raw RPC error off the dashboard UI screen and direct it to the dev console log
          console.warn("Affiliate history revert caught quietly. Initializing safe baseline dashboard view:", ipcError);
          
          // Use an empty array fallback so the downstream functions handle a clean user profile smoothly
          records = [];
        }

        if (!records || !Array.isArray(records)) {
          setReferralRecords([]);
          setTotals({ totalEarned: 0, referralCount: 0 });
          return;
        }

        let cumulativeEarnings = 0n;
        const totalUniqueUsers = new Set();

        const processedRecords = records.map((rec, index) => {
          const rawCommission = BigInt(rec.commission);
          cumulativeEarnings += rawCommission;
          
          if (rec.user && rec.user !== "0x0000000000000000000000000000000000000000") {
            totalUniqueUsers.add(rec.user.toLowerCase());
          }

          return {
            index: index,
            buyer: rec.user || "0xUnknown",
            orderIdx: rec.purchaseIndex || "0",
            hashRef: rec.commissionHash 
              ? `${rec.commissionHash.slice(0, 8)}...${rec.commissionHash.slice(-6)}` 
              : "0x000000",
            payout: `+${formatAllocation(rawCommission || "0")} GBDo`
          };
        });

        setReferralRecords(processedRecords);

        setTotals({
          totalEarned: parseFloat(formatAllocation(cumulativeEarnings || "0")),
          referralCount: totalUniqueUsers.size
        });

      } catch (err) {
        console.error("Affiliate ledger read failure:", err);
        setError(err.message || "Failed to load affiliate ledger records.");
      } finally {
        setLoading(false);
      }
    };

    fetchAffiliateLogs();
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
              AFFILIATE PORTAL
            </h1>
            <p style={{ color: "#555", fontSize: "11px", letterSpacing: "0.5px", margin: 0 }}>
              TRACK BUYERS & MONITOR COMMISSION PAYOUTS
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
              <span style={{ color: "#444" }}>ACTIVE WALLET: </span>
              <span style={{ color: isConnected && userAddress ? "#1c9c31bd" : "#555" }}>
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

      {(!isConnected || error || loading) && (
        <div style={{ ...styles.jsonDisplay, color: error ? "#ef4444" : "#054e1a", marginBottom: "30px", maxHeight: "none" }}>
          {loading && <div>Reading investment records...</div>}
          {error && <div><strong>AUTHORIZATION FAILURE:</strong> {error}</div>}
          {!userAddress && <div>Ready to initialize. Connect your wallet to extract active affiliate records.</div>}
        </div>
      )}
      

      {/* METRIC ROW */}
      {isConnected && userAddress && (
        <div style={{ display: "flex", gap: "16px", marginBottom: "30px" }}>
          <div style={{ ...styles.sectionCard, flex: 1, padding: "16px", margin: 0 }}>
            <span style={{ color: "#666", fontSize: "10px", letterSpacing: "1px", fontWeight: "lighter", display: "block", marginBottom: "6px" }}>CONVERTED ORDERS</span>
            <hr style={styles.divider} />
            <b style={{ fontSize: "16px", fontFamily: "monospace", fontWeight: "lighter", color: "#fff" }}>{totals.referralCount} <span style={{fontSize:"12px", fontWeight: "lighter", color:"#555"}}>ACCOUNTS</span></b>
          </div>
          <div style={{ ...styles.sectionCard, flex: 1, padding: "16px", margin: 0, border: "1px solid rgba(74, 222, 128, 0.15)" }}>
            <span style={{ color: "#1d5c34", fontSize: "10px", letterSpacing: "1px", fontWeight: "lighter", display: "block", marginBottom: "6px" }}>TOTAL ACCRUED PAYOUTS</span>
            <hr style={styles.divider} />
            <b style={{ fontSize: "16px", fontFamily: "monospace", fontWeight: "light", color: "#1d5c34" }}>{totals.totalEarned.toFixed(4)} <span style={{fontSize:"12px", fontWeight: "lighter", color:"#2e7d43"}}>GBDo</span></b>
          </div>
        </div>
      )}

      {/* REFERRAL LEDGER SHEET */}
      <div style={styles.sectionCard}>
        <h2 style={styles.sectionTitle}>Commission Credit Settlements</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #161616", borderTop: "1px solid #161616" }}>
              <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>BUYER</th>
              <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>PURCHASE INDEX</th>
              <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>CLEARING HASH</th>
              <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px", textAlign: "right" }}>SETTLED REWARD</th>
            </tr>
          </thead>
          <tbody>
            {referralRecords.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ ...styles.label, padding: "30px 8px", color: "#444444", textAlign: "center", fontStyle: "italic" }}>
                  {loading ? "Recompiling affiliate allocations..." : "No affiliate commissions found for the connected wallet..."}
                </td>
              </tr>
            ) : (
              referralRecords.map((rec) => (
                <tr key={`affiliate-row-${rec.index}`} style={{ borderBottom: "1px solid #111111" }}>
                  <td style={{ ...styles.label, padding: "12px 8px", fontFamily: "monospace", color: "#aaaaaa" }}>
                    {rec.user.slice(0, 6)}...{rec.user.slice(-4)}
                  </td>
                  <td style={{ ...styles.label, padding: "12px 8px", fontFamily: "monospace", color: "#888888" }}>{rec.purchaseIndex.toString().padStart(3, '0')}</td>
                  <td style={{ ...styles.label, padding: "12px 8px", fontFamily: "monospace", color: "#666666" }}>{rec.commissionHash}</td>
                  <td style={{ ...styles.label, padding: "12px 8px", fontFamily: "monospace", textAlign: "right", color: "#1d5c34", fontWeight: "600" }}>
                    {rec.commission}
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