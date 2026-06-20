// src/components/CorePortfolioMatrix.jsx
import React, { useState, useEffect } from 'react';
import { styles } from '../utils/styles.jsx';
import { deployments } from '../utils/tokensX.js';

export default function CorePortfolioMatrix({ userAddress, activeContract, isConnected }) {
  // Aggregate Overview Totals (For the "TO DATE:" Section Headers)
  const [overviewTotal, setOverviewTotal] = useState("-- GBDo");
  const [purchaseTotal, setPurchaseTotal] = useState("-- GBDo");
  const [vaultDepositTotal, setVaultDepositTotal] = useState("-- GBDo");
  const [ventureDepositTotal, setVentureDepositTotal] = useState("-- GBDo");
  const [vaultWithdrawTotal, setVaultWithdrawTotal] = useState("-- GBDo");
  const [ventureWithdrawTotal, setVentureWithdrawTotal] = useState("-- GBDo");

  // Granular Contract Struct Arrays for Dynamic Table Generation
  const [investmentAllocation, setInvestmentAllocation] = useState(null);
  const [vaultDeposits, setVaultDeposits] = useState([]);
  const [ventureDeposits, setVentureDeposits] = useState([]);
  const [vaultWithdrawals, setVaultWithdrawals] = useState([]);
  const [ventureWithdrawals, setVentureWithdrawals] = useState([]);
  const [allPurchases, setAllPurchases] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNativeOnChainData = async () => {
      if (!userAddress || !isConnected) return;
      setLoading(true);
      setError(null);

      try {
        // Securely pass request parameters straight to Node IPC layer (getExpandedPortfolio)
        const data = await window.electronAPI.getExpandedPortfolio({
          userAddress,
          matrixContractAddress: deployments.GlobalDollar, 
          purchaseContractAddress: deployments.AssetPurchase,
          vaultContractAddress: deployments.SmartVault,
          ventureContractAddress: deployments.RegionInfrastructure
        });

        if (!data || !data.overview) {
          setInvestmentAllocation(null);
          setVaultDeposits([]);
          setVentureDeposits([]);
          setVaultWithdrawals([]);
          setVentureWithdrawals([]);
          setAllPurchases([]);
          return;
        }

        const { overview, vaultStats, ventureStats } = data;

        // BigInt Parsing Context Format Utility
        const formatAllocation = (bigIntValue) => {
          const padded = bigIntValue.toString().padStart(19, '0');
          const splitIdx = padded.length - 18;
          return `${Number(padded.slice(0, splitIdx)).toLocaleString()}.${padded.slice(splitIdx, splitIdx + 4)} GBDo`;
        };

        const formatRawString = (strValue) => formatAllocation(BigInt(strValue || "0"));

        // 1. Map "TO DATE" Headings using safe formatting
        setOverviewTotal(formatRawString(investmentAllocation?.balance));
        setPurchaseTotal(formatRawString(overview.purchases));
        setVaultDepositTotal(formatRawString(overview.vaultDeposit));
        setVentureDepositTotal(formatRawString(overview.ventureDeposit));
        setVaultWithdrawTotal(formatRawString(overview.vaultWithdraw));
        setVentureWithdrawTotal(formatRawString(overview.ventureWithdraw));

        // 2. Map Core Matrix Asset Row
        const rawBalance = BigInt(overview.balance);
        if (rawBalance > 0n) {
          setInvestmentAllocation({
            register: "TOTAL OUTSTANDING BALANCE",
            classification: "Primary Multi-Vault Yield Node Matrix Asset",
            balance: formatAllocation(rawBalance)
          });
        } else {
          setInvestmentAllocation(null);
        }

        // 3. Map Vault & Venture Dynamic Data Structural Blocks directly to localized states
        setVaultDeposits(vaultStats.deposits || []);
        setVentureDeposits(ventureStats.deposits || []);
        setVaultWithdrawals(vaultStats.withdrawals || []);
        setVentureWithdrawals(ventureStats.withdrawals || []);

        // 4. Combine Vault and Venture Purchase Arrays into one single visual timeline list
        const consolidatedPurchases = [
          ...(vaultStats.purchases || []).map(p => ({ ...p, source: 'Vault Pool' })),
          ...(ventureStats.purchases || []).map(p => ({ ...p, source: 'Venture Pool' }))
        ];
        setAllPurchases(consolidatedPurchases);

      } catch (err) {
        console.error("Administrative matrix processing failed:", err);
        setError(err.message || "Failed to retrieve authorized native data arrays.");
      } finally {
        setLoading(false);
      }
    };

    fetchNativeOnChainData();
  }, [userAddress, isConnected]);

  // Dynamic Timestamp parsing helper
  const parseTimestamp = (ts) => {
    if (!ts || ts === "0") return "N/A";
    return new Date(Number(ts) * 1000).toISOString().split('T')[0];
  };

  const formatAllocation = (bigIntValue) => {
    const padded = bigIntValue.toString().padStart(19, '0');
    const splitIdx = padded.length - 18;
    return `${Number(padded.slice(0, splitIdx)).toLocaleString()}.${padded.slice(splitIdx, splitIdx + 4)} GBDo`;
  };

  return (
    <div style={styles.mainContent}>
      {/* GLOBAL SESSION STATUS BAR */} 
      <div style={{ paddingTop: "0px", marginBottom: "6px", borderBottom: "1px solid #161616", paddingBottom: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <p style={{ ...styles.subtitle, margin: 0, padding: "4px 0px" }}>
              ACCOUNT STATUS: {isConnected ? (
                <span style={{ fontFamily: "monospace", color: "#1d5c34", fontWeight: "600" }}>CONNECTED</span>
              ) : (
                <span style={{ color: "#ef4444", fontWeight: "600" }}>DISCONNECTED</span>
              )}
            </p>
          </div>
          
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
                {isConnected && userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : "0xNone"}
            </code>
          </div>
        </div>
      </div>

      <div style={{ paddingTop: "8px", marginBottom: "6px", paddingBottom: "6px" }}>
        <h1 style={{ ...styles.title, fontSize: "18px", fontWeight: "100", margin: 0, paddingBottom: "10px" }}>INVESTOR PORTAL</h1>
      </div>  

      {/* ACCESS & OPERATIONAL MONITOR */}
      {(!isConnected || error || loading) && (
        <div style={{ ...styles.jsonDisplay, color: error ? "#ef4444" : "#054e1a", marginBottom: "30px", maxHeight: "none" }}>
          {loading && <div>Reading investment records...</div>}
          {error && <div><strong>AUTHORIZATION FAILURE:</strong> {error}</div>}
          {!userAddress && <div>Ready to initialize. Connect your wallet to extract active investment records.</div>}
        </div>
      )}

      {/* DASHBOARD LAYOUT GRID */}
      <div style={styles.gridContainer}>        
        
       {/* PANEL 1: TOTAL INVESTMENT ALLOCATIONS */}
        <div style={styles.sectionCard}>
          <div style={{ paddingTop: "0px", marginBottom: "4px", paddingBottom: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
              <h2 style={styles.sectionTitle}>Global Portfolio Overview</h2>
              <div style={{ fontSize: "13px" }}>
                <span style={{ color: "#888", fontSize: "11px", letterSpacing: "0.5px", fontWeight: "600" }}>TO DATE: </span>
                <b style={{ color: "#d3d3d3", fontSize: "11px", fontFamily: "monospace" }}>{overviewTotal}</b>
              </div>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #161616", borderTop: "1px solid #161616" }}>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>PURCHASES</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>VAULT DEPOSITS</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>VAULT WITHDRAWALS</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>VENTURE DEPOSITS</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>VENTURE WITHDRAWALS</th>
              </tr>
            </thead>
            <tbody>
              {!investmentAllocation ? (
                <tr>
                  {/* Updated colSpan to 6 to fit all totals headers perfectly */}
                  <td colSpan="6" style={{ padding: "24px 8px", color: "#444444", textAlign: "center", fontStyle: "italic" }}>No active records found...</td>
                </tr>
              ) : (
                <tr style={{ borderBottom: "1px solid #111111" }}>
                  {/* COL 1: TOTAL PURCHASES COUNT */}
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#888888" }}>
                    {purchaseTotal}
                  </td>

                  {/* COL 2: VAULT DEPOSIT AGGREGATE TOTAL */}
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#1d5c34" }}>
                    {vaultDepositTotal}
                  </td>

                  {/* COL 3: VAULT WITHDRAW AGGREGATE TOTAL */}
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#ef4444" }}>
                    -{vaultWithdrawTotal}
                  </td>

                  {/* COL 4: VENTURE DEPOSIT AGGREGATE TOTAL */}
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#1d5c34" }}>
                    {ventureDepositTotal}
                  </td>

                  {/* COL 5: VENTURE WITHDRAW AGGREGATE TOTAL */}
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#ef4444" }}>
                    -{ventureWithdrawTotal}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PANEL 2: ASSET PROCUREMENT HISTORY (CUSTOM PROCUREMENT VIEW) */}
        <div style={styles.sectionCard}>
          <div style={{ paddingTop: "0px", marginBottom: "4px", paddingBottom: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
              <h2 style={styles.sectionTitle}>Asset Procurement History</h2>
              <div style={{ fontSize: "13px" }}>
                <span style={{ color: "#888", fontSize: "11px", letterSpacing: "0.5px", fontWeight: "600" }}>TO DATE: </span>
                <b style={{ color: "#d3d3d3", fontSize: "11px", fontFamily: "monospace" }}>{purchaseTotal}</b>
              </div>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #161616", borderTop: "1px solid #161616" }}>
                <th style={{ padding: "12px 6px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>ID</th>
                <th style={{ padding: "12px 6px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>TIMESTAMP</th>
                <th style={{ padding: "12px 6px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>QTY</th>
                <th style={{ padding: "12px 6px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>SHIPPING</th>
                <th style={{ padding: "12px 6px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>REGION</th>
                <th style={{ padding: "12px 6px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>PAYMENT METHOD</th>
                <th style={{ padding: "12px 6px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>STATUS</th>
                <th style={{ padding: "12px 6px", color: "#666666", fontSize: "11px", fontWeight: "200", textAlign: "right" }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {allPurchases.length === 0 ? (
                <tr>
                  {/* Updated colSpan to 8 to fit all headers perfectly */}
                  <td colSpan="8" style={{ padding: "24px 8px", color: "#444444", textAlign: "center", fontStyle: "italic" }}>No procurement logs recorded...</td>
                </tr>
              ) : (
                allPurchases.map((p, idx) => (
                  <tr key={`purchase-${idx}`} style={{ borderBottom: "1px solid #111111" }}>
                    {/* COL 1: ID */}
                    <td style={{ padding: "12px 6px", fontFamily: "monospace", color: "#555" }}>
                      {p.id}
                    </td>

                    {/* COL 2: TIMESTAMP */}
                    <td style={{ padding: "12px 6px", color: "#aaa" }}>
                      {parseTimestamp(p.timestamp)}
                    </td>

                    {/* COL 3: QTY */}
                    <td style={{ padding: "12px 6px", fontFamily: "monospace", color: "#bbb" }}>
                      {p.quantity}
                    </td>

                    {/* COL 4: SHIPPING */}
                    <td style={{ padding: "12px 6px", color: "#777", fontSize: '12px' }}>
                      S: {formatAllocation(BigInt(p.shipping))} 
                      <span style={{ display: "block", fontSize: "10px", color: "#444" }}>C: {formatAllocation(BigInt(p.customizations))}</span>
                    </td>

                    {/* COL 5: REGION */}
                    <td style={{ padding: "12px 6px", fontFamily: "monospace", color: "#888", fontSize: "11px" }}>
                      Reg: {p.region}
                    </td>

                    {/* COL 6: PAYMENT METHOD */}
                    <td style={{ padding: "12px 6px", fontFamily: "monospace", color: "#666", fontSize: "11px" }}>
                      {p.source}
                      {p.token && <span style={{ display: 'block', color: '#444', fontSize: "10px" }}>{`${p.token.slice(0,5)}...${p.token.slice(-3)}`}</span>}
                    </td>

                    {/* COL 7: STATUS */}
                    <td style={{ padding: "12px 6px" }}>
                      {p.refund ? (
                        <span style={{ color: "#ef4444", fontSize: "11px", fontWeight: "600" }}>REFUNDED</span>
                      ) : (
                        <span style={{ color: "#1d5c34", fontSize: "11px", fontWeight: "600" }}>SETTLED</span>
                      )}
                    </td>

                    {/* COL 8: AMOUNT (Aligned Right) */}
                    <td style={{ padding: "12px 6px", fontFamily: "monospace", color: "#fff", fontWeight: "600", textAlign: "right" }}>
                      {formatAllocation(BigInt(p.amount))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PANEL 3: VAULT DEPOSIT ALLOCATIONS */}
        <div style={styles.sectionCard}>
          <div style={{ paddingTop: "0px", marginBottom: "4px", paddingBottom: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
              <h2 style={styles.sectionTitle}>Venture Deposit History</h2>
              <div style={{ fontSize: "13px" }}>
                <span style={{ color: "#888", fontSize: "11px", letterSpacing: "0.5px", fontWeight: "600" }}>TO DATE: </span>
                <b style={{ color: "#d3d3d3", fontSize: "11px", fontFamily: "monospace" }}>{vaultDepositTotal}</b>
              </div>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #161616", borderTop: "1px solid #161616" }}>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>TIMESTAMP</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>COMMITMENT START</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>COMMITMENT END</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>AMOUNT IN</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200", textAlign: "right" }}>AMOUNT OUT</th>
              </tr>
            </thead>
            <tbody>
              {vaultDeposits.length === 0 ? (
                <tr>
                  {/* Updated colSpan to 5 to match your headers perfectly */}
                  <td colSpan="5" style={{ padding: "24px 8px", color: "#444444", textAlign: "center", fontStyle: "italic" }}>No active venture records logged...</td>
                </tr>
              ) : (
                vaultDeposits.map((d, idx) => (
                  <tr key={`venture-dep-${idx}`} style={{ borderBottom: "1px solid #111111" }}>
                    {/* COL 1: TIMESTAMP */}
                    <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#aaa" }}>{parseTimestamp(d.timestamp)}</td>
                    
                    {/* COL 2: COMMITMENT START */}
                    <td style={{ padding: "12px 8px", color: "#fff" }}>
                      Q${(d.startQuarter % 4) + 1} ${Math.floor(w.startQuarter / 4)}
                    </td>
                    
                    {/* COL 3: COMMITMENT END */}
                    <td style={{ padding: "12px 8px", color: "#bbb" }}>
                      {d.unlockQuarter ? `Q${(d.unlockQuarter % 4) + 1} ${Math.floor(d.unlockQuarter / 4)}` : d.refund ? <span style={{ color: "#ef4444", fontWeight: "600", fontSize: "11px" }}>REFUNDED</span> : "Active"}
                    </td>
                    
                    {/* COL 4: AMOUNT IN */}
                    <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#1d5c34", fontWeight: "600" }}>
                      +{formatAllocation(BigInt(d.amountin))}
                    </td>
                    
                    {/* COL 5: AMOUNT OUT (Aligned Right) */}
                    <td style={{ padding: "12px 8px", fontFamily: "monospace", textAlign: "right", color: "#888" }}>
                      {formatAllocation(BigInt(d.amountout))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PANEL 4: VENTURE DEPOSIT ALLOCATIONS */}
        <div style={styles.sectionCard}>
          <div style={{ paddingTop: "0px", marginBottom: "4px", paddingBottom: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
              <h2 style={styles.sectionTitle}>Venture Deposit History</h2>
              <div style={{ fontSize: "13px" }}>
                <span style={{ color: "#888", fontSize: "11px", letterSpacing: "0.5px", fontWeight: "600" }}>TO DATE: </span>
                <b style={{ color: "#d3d3d3", fontSize: "11px", fontFamily: "monospace" }}>{ventureDepositTotal}</b>
              </div>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #161616", borderTop: "1px solid #161616" }}>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>TIMESTAMP</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>COMMITMENT START</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>COMMITMENT END</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>AMOUNT IN</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200", textAlign: "right" }}>AMOUNT OUT</th>
              </tr>
            </thead>
            <tbody>
              {ventureDeposits.length === 0 ? (
                <tr>
                  {/* Updated colSpan to 5 to match your headers perfectly */}
                  <td colSpan="5" style={{ padding: "24px 8px", color: "#444444", textAlign: "center", fontStyle: "italic" }}>No active venture records logged...</td>
                </tr>
              ) : (
                ventureDeposits.map((d, idx) => (
                  <tr key={`venture-dep-${idx}`} style={{ borderBottom: "1px solid #111111" }}>
                    {/* COL 1: TIMESTAMP */}
                    <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#aaa" }}>{parseTimestamp(d.timestamp)}</td>
                    
                    {/* COL 2: COMMITMENT START */}
                    <td style={{ padding: "12px 8px", color: "#fff" }}>
                      Q${(d.startQuarter % 4) + 1} ${Math.floor(w.startQuarter / 4)}
                    </td>
                    
                    {/* COL 3: COMMITMENT END */}
                    <td style={{ padding: "12px 8px", color: "#bbb" }}>
                      {d.unlockQuarter ? `Q${(d.unlockQuarter % 4) + 1} ${Math.floor(d.unlockQuarter / 4)}` : d.refund ? <span style={{ color: "#ef4444", fontWeight: "600", fontSize: "11px" }}>REFUNDED</span> : "Active"}
                    </td>
                    
                    {/* COL 4: AMOUNT IN */}
                    <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#1d5c34", fontWeight: "600" }}>
                      +{formatAllocation(BigInt(d.amountin))}
                    </td>
                    
                    {/* COL 5: AMOUNT OUT (Aligned Right) */}
                    <td style={{ padding: "12px 8px", fontFamily: "monospace", textAlign: "right", color: "#888" }}>
                      {formatAllocation(BigInt(d.amountout))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PANEL 5: VAULT WITHDRAW ALLOCATIONS */}
        <div style={styles.sectionCard}>
          <div style={{ paddingTop: "0px", marginBottom: "4px", paddingBottom: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
              <h2 style={styles.sectionTitle}>Vault Withdrawal History</h2>
              <div style={{ fontSize: "13px" }}>
                <span style={{ color: "#888", fontSize: "11px", letterSpacing: "0.5px", fontWeight: "600" }}>TO DATE: </span>
                <b style={{ color: "#d3d3d3", fontSize: "11px", fontFamily: "monospace" }}>{vaultWithdrawTotal}</b>
              </div>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #161616", borderTop: "1px solid #161616" }}>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>TIMESTAMP</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>COMMITMENT START</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>COMMITMENT END</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>DIVIDEND TOKEN</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200", textAlign: "right" }}>PAYOUT AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {vaultWithdrawals.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: "24px 8px", color: "#444444", textAlign: "center", fontStyle: "italic" }}>No withdrawal records logged...</td>
                </tr>
              ) : (
                vaultWithdrawals.map((w, idx) => (
                  <tr key={`vault-w-${idx}`} style={{ borderBottom: "1px solid #111111" }}>
                    {/* COL 1: TIMESTAMP */}
                    <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#888" }}>
                      {w.timestamp ? parseTimestamp(w.timestamp) : "N/A"}
                    </td>
                    
                    {/* COL 2: COMMITMENT START */}
                    <td style={{ padding: "12px 8px", color: "#bbb" }}>
                      Q${(d.startQuarter % 4) + 1} ${Math.floor(w.startQuarter / 4)}
                    </td>
                    
                    {/* COL 3: COMMITMENT END */}
                    <td style={{ padding: "12px 8px", color: "#fff" }}>
                      Q${(d.unlockQuarter % 4) + 1} ${Math.floor(d.unlockQuarter / 4)}
                    </td>
                    {/* COL 4: DIVIDEND TOKEN */}
                    <td style={{ padding: "12px 8px", color: "#fff" }}>
                      {w.dividendToken && (
                        <span style={{ display: "block", fontSize: "10px", color: "#555", fontFamily: "monospace" }}>
                          {`${w.dividendToken.slice(0, 6)}...${w.dividendToken.slice(-4)}`}
                        </span>
                      )}
                    </td>
                    
                    {/* COL 4: PAYOUT AMOUNT (Aligned Right) */}
                    <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#ef4444", textAlign: "right", fontWeight: "600" }}>
                      -{formatAllocation(BigInt(w.userDividendAmount))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PANEL 6: VAULT WITHDRAW ALLOCATIONS */}
        <div style={styles.sectionCard}>
          <div style={{ paddingTop: "0px", marginBottom: "4px", paddingBottom: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
              <h2 style={styles.sectionTitle}>Vault Withdrawal History</h2>
              <div style={{ fontSize: "13px" }}>
                <span style={{ color: "#888", fontSize: "11px", letterSpacing: "0.5px", fontWeight: "600" }}>TO DATE: </span>
                <b style={{ color: "#d3d3d3", fontSize: "11px", fontFamily: "monospace" }}>{ventureWithdrawTotal}</b>
              </div>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #161616", borderTop: "1px solid #161616" }}>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>TIMESTAMP</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>COMMITMENT START</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>COMMITMENT END</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>VENTURE TOKEN</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200", textAlign: "right" }}>PAYOUT AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {ventureWithdrawals.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: "24px 8px", color: "#444444", textAlign: "center", fontStyle: "italic" }}>No withdrawal records logged...</td>
                </tr>
              ) : (
                ventureWithdrawals.map((w, idx) => (
                  <tr key={`vault-w-${idx}`} style={{ borderBottom: "1px solid #111111" }}>
                    {/* COL 1: TIMESTAMP */}
                    <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#888" }}>
                      {w.timestamp ? parseTimestamp(w.timestamp) : "N/A"}
                    </td>
                    
                    {/* COL 2: COMMITMENT START */}
                    <td style={{ padding: "12px 8px", color: "#bbb" }}>
                      Q${(d.startQuarter % 4) + 1} ${Math.floor(w.startQuarter / 4)}
                    </td>
                    
                    {/* COL 3: COMMITMENT END */}
                    <td style={{ padding: "12px 8px", color: "#fff" }}>
                      Q${(d.unlockQuarter % 4) + 1} ${Math.floor(d.unlockQuarter / 4)}
                    </td>
                    {/* COL 4: VENTURE TOKEN */}
                    <td style={{ padding: "12px 8px", color: "#fff" }}>
                      {w.ventureToken && (
                        <span style={{ display: "block", fontSize: "10px", color: "#555", fontFamily: "monospace" }}>
                          {`${w.ventureToken.slice(0, 6)}...${w.ventureToken.slice(-4)}`}
                        </span>
                      )}
                    </td>
                    
                    {/* COL 4: PAYOUT AMOUNT (Aligned Right) */}
                    <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#ef4444", textAlign: "right", fontWeight: "600" }}>
                      -{formatAllocation(BigInt(w.userDividendAmount))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}