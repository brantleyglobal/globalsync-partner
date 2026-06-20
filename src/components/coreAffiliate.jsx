// src/components/AffiliatePortal.jsx
import React, { useState, useEffect } from 'react';
import { styles } from '../utils/styles.jsx';
import { deployments } from '../utils/tokensX.js';

export default function AffiliatePortal({ userAddress, activeContract, isConnected }) {
  const [referralRecords, setReferralRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
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
        // Request data via your Electron IPC bridge handler
        const records = await window.electronAPI.getAffiliateHistory({
          userAddress,
          contractAddress: deployments.AssetPurchase, 
          chainKey: "global" 
        });

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
      {/* FLEX CONTAINER TO ALIGN ITEMS SIDE-BY-SIDE */}
      <div style={{ paddingTop: "0px", marginBottom: "6px", borderBottom: "1px solid #161616", paddingBottom: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
            
          {/* LEFT FLANK: IDENTITY & STATUS */}
          <div>
              <p style={{ ...styles.subtitle, margin: 0, padding: "4px 0px", }}>
                  ACCOUNT STATUS: {isConnected ? (
                  <span style={{ fontFamily: "monospace", color: "#1d5c34", fontWeight: "600", }}>CONNECTED</span>
                  ) : (
                  <span style={{ color: "#ef4444", fontWeight: "600" }}>DISCONNECTED</span>
                  )}
              </p>
          </div>
          
          {/* RIGHT FLANK: ANCHORED ACTIVE WALLET COMPONENT */}
          <div style={{ display: "flex", alignItems: "center", fontSize: "13px" }}>
            <span style={{ color: "#888", marginRight: "8px", fontSize: "11px", letterSpacing: "0.5px", fontWeight: "600" }}>ACTIVE WALLET:</span>
            <code style={{ 
                background: "#0a0a0a", 
                padding: "4px 4px", 
                borderRadius: "4px", 
                color: userAddress ? "#1d5c34" : "#555",
                fontFamily: "monospace",
                border: "1px solid #111"
            }}>
                {isConnected && userAddress 
                ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` 
                : "0xNone"}
            </code>
          </div>

        </div>
      </div>
      <div style={{ paddingTop: "8px", marginBottom: "6px", paddingBottom: "6px" }}>
        <h1 style={{ ...styles.title, fontSize: "18px", fontWeight: "100", margin: 0, paddingBottom: "10px" }}>AFFIILIATE PORTAL</h1>
      </div>  

      {/* COMPLIANCE MONITOR */}
      {error && (
        <div style={{ ...styles.jsonDisplay, color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.2)", marginBottom: "30px" }}>
          <strong>AFFILIATE CONTEXT ERROR:</strong> {error}
        </div>
      )}
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
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>BUYER</th>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>PURCHASE INDEX</th>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>CLEARING HASH</th>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200", textAlign: "right" }}>SETTLED REWARD</th>
            </tr>
          </thead>
          <tbody>
            {referralRecords.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: "30px 8px", color: "#444444", textAlign: "center", fontStyle: "italic" }}>
                  {loading ? "Recompiling affiliate allocations..." : "No affiliate commissions found for the connected wallet..."}
                </td>
              </tr>
            ) : (
              referralRecords.map((rec) => (
                <tr key={`affiliate-row-${rec.index}`} style={{ borderBottom: "1px solid #111111" }}>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#aaaaaa" }}>
                    {rec.user.slice(0, 6)}...{rec.user.slice(-4)}
                  </td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#888888" }}>{rec.purchaseIndex.toString().padStart(3, '0')}</td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#666666" }}>{rec.commissionHash}</td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", textAlign: "right", color: "#1d5c34", fontWeight: "600" }}>
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