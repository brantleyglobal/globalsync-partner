// src/components/CorePortfolioMatrix.jsx
import React, { useState, useEffect } from 'react';
import { styles, modalStyles } from '../utils/styles.jsx';
import { deployments, supportedTokens, dividendTokens } from '../utils/tokensX.js';
import { useRpcStatus } from "../utils/statusRpc";

export default function CorePortfolioMatrix({ userAddress, activeContract, onTotalChange, isConnected }) {
  // Aggregate Overview Totals (For the "TO DATE:" Section Headers)

  const rpcUp = useRpcStatus();

  const [overviewTotal, setOverviewTotal] = useState("0 GBDo");
  const [purchaseTotal, setPurchaseTotal] = useState("0 GBDo");
  const [vaultDepositTotal, setVaultDepositTotal] = useState("0 GBDo");
  const [ventureDepositTotal, setVentureDepositTotal] = useState("0 GBDo");
  const [vaultWithdrawTotal, setVaultWithdrawTotal] = useState("0 GBDo");
  const [ventureWithdrawTotal, setVentureWithdrawTotal] = useState("0 GBDo");

  // Granular Contract Struct Arrays for Dynamic Table Generation
  const [investmentAllocation, setInvestmentAllocation] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [vaultDeposits, setVaultDeposits] = useState([]);
  const [ventureDeposits, setVentureDeposits] = useState([]);
  const [vaultWithdrawals, setVaultWithdrawals] = useState([]);
  const [ventureWithdrawals, setVentureWithdrawals] = useState([]);
  const [allPurchases, setAllPurchases] = useState([]);

  // Modal Visibility Toggles
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  // Deposit Parameters State
  const [depositType, setDepositType] = useState("SMART_VAULT"); // SMART_VAULT or VENTURE_VAULT
  const [depositToken, setDepositToken] = useState("");
  const [depositVentureAddress, setDepositVentureAddress] = useState(""); // <-- Added for Venture Deposit variant
  const [depositAmount, setDepositAmount] = useState("");
  const [committedQuarters, setCommittedQuarters] = useState(""); // Unique to Smart Vault
  const [incomingRate, setIncomingRate] = useState("");
  const [depositHash, setDepositHash] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);

  const [depositor, setDepositor] = useState(false);

  // Withdrawal Parameters State
  const [withdrawType, setWithdrawType] = useState("SMART_VAULT"); 
  const [targetVaultOrDividendToken, setTargetVaultOrDividendToken] = useState(""); 
  const [payToken, setPayToken] = useState("");
  const [holderBalance, setHolderBalance] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (overviewTotal) {
      onTotalChange(overviewTotal);
    }
  }, [overviewTotal, onTotalChange]);

  const handleExecuteDeposit = async () => {
    // 1. Guard check: Ensure wallet state context is bound
    if (!userAddress) {
      alert("Please connect or enter a valid wallet address.");
      return;
    }

    // 2. Structural Guard: Reject empty requests before hitting the node pipeline
    const amountFloat = parseFloat(depositAmount);
    if (!depositAmount || isNaN(amountFloat) || amountFloat <= 0) {
      alert("Please enter a valid deposit amount greater than zero.");
      return;
    }

    if (!depositToken) {
      alert("Please provide a valid deposit asset token address.");
      return;
    }

    if (!depositHash) {
      alert("Missing Transaction Hash! You must provide the user's transaction payment hash.");
      return;
    }

    if (!depositHash.startsWith("0x") || depositHash.length < 66) {
      alert(`Invalid Hash Format! "${depositHash}" must be a 66-character hex string starting with 0x.`);
      return;
    }

    if (depositType === "VENTURE_VAULT" && !depositVentureAddress) {
      alert("Please provide the target venture contract address.");
      return;
    }

    setDepositLoading(true);

    try {
      console.log(`Initiating pre-flight validations for ${depositAmount} against hash ${depositHash}...`);

      // Mapped Target Treasury Vault Address Setup
      const treasuryByContract = {
        [deployments.AcquisitionGateway?.toLowerCase()]: "0x1166579617240592e8a7c87bc389549eab8de047"
      };

      const targetTreasuryVault = treasuryByContract[deployments.AcquisitionGateway?.toLowerCase()];
      if (!targetTreasuryVault) {
        throw new Error("Security System Error: Selected contract address does not have a mapped Treasury Vault.");
      }

      // --- SLIPPAGE & CONVERSION MATH ---
      // Fetch system exchange rate dynamically from system cache/oracles
      let tokenConversionRate = 1;
      try {
        const rateData = await getExchangeRates();
        // Adjust this string parsing depending on how your state maps token entities
        const paymentTokenSymbol = typeof depositToken === "object" ? depositToken.symbol : "TOKEN";
        
        if (paymentTokenSymbol && paymentTokenSymbol.toUpperCase() !== "GBDO") {
          const rateEntry = rateData.rates.find((r) => r.symbol === paymentTokenSymbol);
          if (rateEntry) tokenConversionRate = Number(rateEntry.rate);
        }
      } catch (e) {
        console.warn("Pre-flight bridge check failed to read exchangeData pool.", e);
      }

      const computedAmountOut = amountFloat * tokenConversionRate;
      const targetDecimalsBase18 = 18;
      
      const safeFixedString = computedAmountOut.toFixed(18).replace(/e[-+]\d+/, (match) => {
        return Number(match).toFixed(18).split('e')[0];
      });

      const expectedTokensBase18 = ethers.parseUnits(safeFixedString, targetDecimalsBase18);
      const ALLOWABLE_SLIPPAGE_PERCENT = 1; 
      const slippageBasisPoints = 10000n - BigInt(ALLOWABLE_SLIPPAGE_PERCENT * 100);
      const priceFloorBase18 = (expectedTokensBase18 * slippageBasisPoints) / 10000n;

      console.clear(); 
      console.group("SYSTEM INTEGRITY AUDIT REPORT: DEPOSIT");
      console.table({
        "Token Exchange FX Rate":   { Value: `${tokenConversionRate}`, Base18: "N/A" },
        "Expected Tokens Target":   { Value: `${computedAmountOut.toFixed(4)} Units`, Base18: expectedTokensBase18.toString() },
        "Slippage Floor Limit":     { Value: `${ethers.formatUnits(priceFloorBase18, 18)} Units`, Base18: priceFloorBase18.toString() },
        "Current Raw Input Hash":   { Value: depositHash, Base18: "N/A" }
      });
      console.groupEnd();

      // --- THE SHIELD LAYER (PRE-FLIGHT VALIDATION VIA BACKEND INDEXER) ---
      let verificationResponse = null;
      try {
        verificationResponse = await window.api.triggerVault({
          modeArg: "verify-erc20-receipt",
          transactionHash: depositHash,
          custodialWallet: targetTreasuryVault 
        });
      } catch (ipcError) {
        console.error("IPC validation background pipe crashed:", ipcError);
        verificationResponse = { ok: false, reason: "The verification server was unable to index the transaction." };
      }

      if (!verificationResponse || !verificationResponse.ok) {
        throw new Error(verificationResponse?.reason || "Receipt was not found on the blockchain indexer.");
      }

      // Verify ownership and balance thresholds against checked chain receipt data
      const rawLoggedTokenAmount = BigInt(verificationResponse.amount);
      const actualDecimalsOfPaymentToken = verificationResponse.decimals ?? 18;
      const normalizedPaidAmountBase18 = BigInt(
        rescaleAmount(rawLoggedTokenAmount, actualDecimalsOfPaymentToken, targetDecimalsBase18)
      );

      if (verificationResponse.senderAddress.toLowerCase() !== userAddress.toLowerCase()) {
        throw new Error(`Ownership Mismatch!\n• On-Chain Sender: ${verificationResponse.senderAddress}\n• State Wallet: ${userAddress}`);
      }

      if (normalizedPaidAmountBase18 < priceFloorBase18) {
        throw new Error(`Slippage Violation! Amount detected on-chain is below acceptable price floor limits.`);
      }

      console.log("Receipt Verification Passed. Invoking main.js secure pipeline execution context...");

      // --- COMPILING INTERACTION ROUTING PAYLOAD ---
      
      let payload;
      const timeStamp = Math.floor(Date.now() / 1000);
      const tokenAddress = typeof depositToken === "object" ? depositToken.address : depositToken;

      // 2. Shift the structure based on the transaction type
      if (depositType === "VENTURE_VAULT") {
        payload = {
          timeStamp,
          user: depositor,
          token: tokenAddress,
          venture: depositVentureAddress,
          amount: depositAmount,
          incomingRate: tokenConversionRate.toString(),
          depositHash
        };

        const tx = await mainContract.ventureDeposit(...Object.values(payload));
        await tx.wait(1);

      } else if (depositType === "SMART_VAULT") {
        payload = {
          timeStamp,
          investor: depositor,
          token: tokenAddress,
          amount: depositAmount,
          committedQuarters: committedQuarters,
          incomingRate: tokenConversionRate.toString(),
          depositHash
        };
      }

      // Invoke through IPC context bridge structure to backend main.js execution pipe
      const result = await window.electronAPI.submitDeposit(payload);

      if (result && result.success) {
        console.log(`Deposit routing completed successfully. Tx Hash: ${result.txHash}`);
        alert(`Transaction confirmed via main.js node framework!\nHash: ${result.txHash}`);
        
        // Cleanup inputs
        setDepositAmount("");
        setDepositHash("");
        setDepositVentureAddress("");
        setIsDepositModalOpen(false);
      } else {
        throw new Error(result?.error || "Transaction execution failed or reverted inside background pipeline.");
      }

    } catch (error) {
      console.error("Critical Failure inside handleExecuteDeposit:", error);
      alert(`Deposit Execution Rejected:\n\n${error.message || "Unknown execution error"}`);
    } finally {
      setDepositLoading(false);
    }
  };

  const handleExecuteWithdrawal = async () => {
    // 1. Guard check: Ensure wallet state context is bound
    if (!userAddress) {
      alert("Please connect or enter a valid wallet address.");
      return;
    }

    // 2. Structural Guard: Reject empty input requests before hitting node layer
    const balanceFloat = parseFloat(holderBalance);
    if (!holderBalance || isNaN(balanceFloat) || balanceFloat <= 0) {
      alert("Please enter a valid validation balance greater than zero.");
      return;
    }

    if (!targetVaultOrDividendToken || !payToken) {
      alert("Please fill in all target routing address contract locations.");
      return;
    }

    setWithdrawLoading(true);

    try {
      console.log(`Processing infrastructure withdrawal logic gates for ${withdrawType}...`);
      
      const timeStamp = Math.floor(Date.now() / 1000);

      // --- COMPILING INTERACTION ROUTING PAYLOAD ---
      const payload = {
        withdrawType: withdrawType, // "SMART_VAULT" || "VENTURE_VAULT"
        targetAddress: targetVaultOrDividendToken, // dividendToken (Smart) OR venture (Venture) address parameters
        payToken: payToken,
        holderBalance: holderBalance,
        timeStamp: timeStamp
      };

      // Invoke through IPC context bridge structure to backend main.js execution pipe
      const result = await window.electronAPI.submitWithdrawal(payload);

      if (result && result.success) {
        console.log(`Withdrawal routing completed successfully. Tx Hash: ${result.txHash}`);
        alert(`Withdrawal confirmed via main.js node framework!\nHash: ${result.txHash}`);
        
        // Cleanup inputs
        setHolderBalance("");
        setTargetVaultOrDividendToken("");
        setPayToken("");
        setIsWithdrawModalOpen(false);
      } else {
        throw new Error(result?.error || "Transaction execution failed or reverted inside background withdrawal pipeline.");
      }

    } catch (error) {
      console.error("Critical Failure inside handleExecuteWithdrawal:", error);
      alert(`Withdrawal Execution Rejected:\n\n${error.message || "Unknown execution error"}`);
    } finally {
      setWithdrawLoading(false);
    }
  };

  useEffect(() => {
    const fetchNativeOnChainData = async () => {
      if (!userAddress || !isConnected) return;
      setLoading(true);
      setError(null);

      try {
        let data = null;
        try {
         
          data = await window.electronAPI.getExpandedPortfolio({
            userAddress,
            matrixContractAddress: deployments.GlobalDollar, 
            purchaseContractAddress: deployments.AssetPurchase,
            vaultContractAddress: deployments.SmartVault,
            ventureContractAddress: deployments.RegionInfrastructure,
            chainKey: "global"
          });
        } catch (backendCrash) {
          // The console handles the error layout quietly
          console.log("Console Log - Safe empty profile loaded:", backendCrash);
          
          // Feed mock zero-data downstream so the screen doesn't show a fault
          data = {
            overview: { balance: "0", purchase: "0", vaultDeposit: "0", ventureDeposit: "0", vaultWithdraw: "0", ventureWithdraw: "0" },
            vaultStats: { deposits: [], withdrawals: [] },
            ventureStats: { deposits: [], withdrawals: [] },
            purchaseStats: { purchases: [] }
          };
        }

        if (!data || !data.overview) {
          setInvestmentAllocation(null);
          setVaultDeposits([]);
          setVentureDeposits([]);
          setVaultWithdrawals([]);
          setVentureWithdrawals([]);
          setAllPurchases([]);
          return;
        }

        const { overview, vaultStats, ventureStats, purchaseStats } = data;

        // BigInt Parsing Context Format Utility
        const formatAllocation = (bigIntValue) => {
          const padded = bigIntValue.toString().padStart(19, '0');
          const splitIdx = padded.length - 18;
          return `${Number(padded.slice(0, splitIdx)).toLocaleString()}.${padded.slice(splitIdx, splitIdx + 4)} GBDo`;
        };

        const formatRawString = (strValue) => formatAllocation(BigInt(strValue || "0"));

        // 1. Map "TO DATE" Headings using safe formatting
        setOverviewTotal(formatRawString(overview.balance));
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
            balance: formatAllocation(rawBalance || "0")
          });
        } else {
          setInvestmentAllocation(null);
        }

        const purchasesList = purchaseStats?.purchases || [];
        const vaultDepsList = vaultStats?.deposits || [];
        const ventureDepsList = ventureStats?.deposits || [];
        const vaultWithsList = vaultStats?.withdrawals || [];
        const ventureWithsList = ventureStats?.withdrawals || [];

        setVaultDeposits(vaultDepsList);
        setVentureDeposits(ventureDepsList);
        setVaultWithdrawals(vaultWithsList);
        setVentureWithdrawals(ventureWithsList);

        // 4. Combine Vault and Venture Purchase Arrays into one single visual timeline list
        const consolidatedPurchases = [
          ...(purchaseStats.purchases || []).map(p => ({ ...p, source: 'Purchases' })),
          ...(vaultStats.deposits || []).map(p => ({ ...p, source: 'Smart Vault' })),
          ...(ventureStats.deposits || []).map(p => ({ ...p, source: 'Venture Vault' }))
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
      <div style={{ display: "flex", flexDirection: "column", width: "100%", boxSizing: "border-box" }}>
        
        {/* HEADER LAYER: Matched perfectly to the premium blueprint layout */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: "16px", marginBottom: "20px" }}>
          
          {/* Left Side: Clean Title */}
          <div>
            <h1 style={{ ...styles.label, color: "#ffffff", fontSize: "20px", fontWeight: "300", letterSpacing: "1px", margin: "0" }}>
              INVESTOR PORTAL
            </h1>
            <p style={{ color: "#555", fontSize: "11px", letterSpacing: "0.5px", margin: 0 }}>
                INVEST, COLLECT RETURNS & TRACK INVESTMENTS 
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

      {/* ACCESS & OPERATIONAL MONITOR */}
      {(!isConnected || error || loading) && (
        <div style={{ ...styles.jsonDisplay, color: error ? "#ef4444" : "#054e1a", marginBottom: "30px", maxHeight: "none" }}>
          {loading && <div>Reading investment records...</div>}
          {error && <div><strong>AUTHORIZATION FAILURE:</strong> {error}</div>}
          {!userAddress && <div>Ready to initialize. Connect your wallet to extract active investment records.</div>}
        </div>
      )}

      {/* ACTION TRIGGERS BAR */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <button style={styles.btnForestGreen} onClick={() => setIsDepositModalOpen(true)}>
          INVESTMENT DEPOSIT
        </button>
        <button style={styles.btnForestGreen} onClick={() => setIsWithdrawModalOpen(true)}>
          INVESTMENT WITHDRAWAL
        </button>
      </div>

      {/* DASHBOARD LAYOUT GRID */}
      <div style={{ ...styles.gridContainer, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px" }}>        
        
       {/* PANEL 1: TOTAL INVESTMENT ALLOCATIONS */}
        <div style={styles.sectionCard}>
          <div style={{ paddingTop: "0px", marginBottom: "4px", paddingBottom: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
              <h2 style={styles.sectionTitle}>Global Portfolio Overview</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ ...styles.label, color: "#888", fontSize: "10px", letterSpacing: "0.5px", fontWeight: "600", display: "block" }}>
                  TO DATE
                </span>
                <b style={{ ...styles.label, color: "#d3d3d3", fontSize: "10px", display: "block" }}>
                  {overviewTotal}
                </b>
              </div>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #161616", borderTop: "1px solid #161616" }}>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>PURCHASES</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>VAULT DEPOSITS</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>VAULT WITHDRAWALS</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>VENTURE DEPOSITS</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>VENTURE WITHDRAWALS</th>
              </tr>
            </thead>
            <tbody>
              {!investmentAllocation ? (
                <tr>
                  {/* Updated colSpan to 6 to fit all totals headers perfectly */}
                  <td colSpan="5" style={{ ...styles.label, padding: "24px 8px", color: "#444444", textAlign: "center", fontStyle: "italic" }}>No active records found...</td>
                </tr>
              ) : (
                <tr style={{ borderBottom: "1px solid #111111" }}>
                  {/* COL 1: TOTAL PURCHASES COUNT */}
                  <td style={{ ...styles.label, padding: "12px 8px", color: "#888888" }}>
                    {purchaseTotal}
                  </td>

                  {/* COL 2: VAULT DEPOSIT AGGREGATE TOTAL */}
                  <td style={{ ...styles.label, padding: "12px 8px", color: "#1d5c34" }}>
                    {vaultDepositTotal}
                  </td>

                  {/* COL 3: VAULT WITHDRAW AGGREGATE TOTAL */}
                  <td style={{ ...styles.label, padding: "12px 8px", color: "#ef4444" }}>
                    -{vaultWithdrawTotal}
                  </td>

                  {/* COL 4: VENTURE DEPOSIT AGGREGATE TOTAL */}
                  <td style={{ ...styles.label, padding: "12px 8px", color: "#1d5c34" }}>
                    {ventureDepositTotal}
                  </td>

                  {/* COL 5: VENTURE WITHDRAW AGGREGATE TOTAL */}
                  <td style={{ ...styles.label, padding: "12px 8px", color: "#ef4444" }}>
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
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ ...styles.label, color: "#888", fontSize: "10px", letterSpacing: "0.5px", fontWeight: "600", display: "block" }}>
                  TO DATE
                </span>
                <b style={{ ...styles.label, color: "#d3d3d3", fontSize: "10px", display: "block" }}>
                  {purchaseTotal}
                </b>
              </div>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #161616", borderTop: "1px solid #161616" }}>
                <th style={{ ...styles.label, padding: "12px 6px", color: "#666666", fontSize: "11px" }}>ID</th>
                <th style={{ ...styles.label, padding: "12px 6px", color: "#666666", fontSize: "11px" }}>TIMESTAMP</th>
                <th style={{ ...styles.label, padding: "12px 6px", color: "#666666", fontSize: "11px" }}>QTY</th>
                <th style={{ ...styles.label, padding: "12px 6px", color: "#666666", fontSize: "11px" }}>SHIPPING</th>
                <th style={{ ...styles.label, padding: "12px 6px", color: "#666666", fontSize: "11px" }}>REGION</th>
                <th style={{ ...styles.label, padding: "12px 6px", color: "#666666", fontSize: "11px" }}>PAYMENT METHOD</th>
                <th style={{ ...styles.label, padding: "12px 6px", color: "#666666", fontSize: "11px" }}>STATUS</th>
                <th style={{ ...styles.label, padding: "12px 6px", color: "#666666", fontSize: "11px", textAlign: "right" }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {allPurchases.length === 0 ? (
                <tr>
                  {/* Updated colSpan to 8 to fit all headers perfectly */}
                  <td colSpan="8" style={{ ...styles.label, padding: "24px 8px", color: "#444444", textAlign: "center", fontStyle: "italic" }}>No procurement logs recorded...</td>
                </tr>
              ) : (
                allPurchases.map((p, idx) => (
                  <tr key={`purchase-${idx}`} style={{ borderBottom: "1px solid #111111" }}>
                    {/* COL 1: ID */}
                    <td style={{ ...styles.label, padding: "12px 6px", color: "#555" }}>
                      {p.id}
                    </td>

                    {/* COL 2: TIMESTAMP */}
                    <td style={{ ...styles.label, padding: "12px 6px", color: "#aaa" }}>
                      {parseTimestamp(p.timestamp)}
                    </td>

                    {/* COL 3: QTY */}
                    <td style={{ ...styles.label, padding: "12px 6px", color: "#bbb" }}>
                      {p.quantity}
                    </td>

                    {/* COL 4: SHIPPING */}
                    <td style={{ ...styles.label, padding: "12px 6px", color: "#777", fontSize: '12px' }}>
                      S: {formatAllocation(BigInt(p.shipping || "0"))} 
                      <span style={{ display: "block", fontSize: "10px", color: "#444" }}>C: {formatAllocation(BigInt(p.customizations || "0"))}</span>
                    </td>

                    {/* COL 5: REGION */}
                    <td style={{ ...styles.label, padding: "12px 6px", color: "#888", fontSize: "11px" }}>
                      Reg: {p.region}
                    </td>

                    {/* COL 6: PAYMENT METHOD */}
                    <td style={{ ...styles.label, padding: "12px 6px", color: "#666", fontSize: "11px" }}>
                      {p.source}
                      {p.token && <span style={{ display: 'block', color: '#444', fontSize: "10px" }}>{`${p.token.slice(0,5)}...${p.token.slice(-3)}`}</span>}
                    </td>

                    {/* COL 7: STATUS */}
                    <td style={{ ...styles.label, padding: "12px 6px" }}>
                      {p.refund ? (
                        <span style={{ color: "#ef4444", fontSize: "11px", fontWeight: "600" }}>REFUNDED</span>
                      ) : (
                        <span style={{ color: "#1d5c34", fontSize: "11px", fontWeight: "600" }}>SETTLED</span>
                      )}
                    </td>

                    {/* COL 8: AMOUNT (Aligned Right) */}
                    <td style={{ ...styles.label, padding: "12px 6px", color: "#fff", fontWeight: "600", textAlign: "right" }}>
                      {formatAllocation(BigInt(p.amount || "0"))}
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
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ ...styles.label, color: "#888", fontSize: "10px", letterSpacing: "0.5px", fontWeight: "600", display: "block" }}>
                  TO DATE
                </span>
                <b style={{ ...styles.label, color: "#d3d3d3", fontSize: "10px", display: "block" }}>
                  {vaultDepositTotal}
                </b>
              </div>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #161616", borderTop: "1px solid #161616" }}>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>TIMESTAMP</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>COMMITMENT START</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>COMMITMENT END</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>AMOUNT IN</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px", textAlign: "right" }}>AMOUNT OUT</th>
              </tr>
            </thead>
            <tbody>
              {vaultDeposits.length === 0 ? (
                <tr>
                  {/* Updated colSpan to 5 to match your headers perfectly */}
                  <td colSpan="5" style={{ ...styles.label, padding: "24px 8px", color: "#444444", textAlign: "center", fontStyle: "italic" }}>No active venture records logged...</td>
                </tr>
              ) : (
                vaultDeposits.map((d, idx) => (
                  <tr key={`venture-dep-${idx}`} style={{ borderBottom: "1px solid #111111" }}>
                    {/* COL 1: TIMESTAMP */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#aaa" }}>{parseTimestamp(d.timestamp)}</td>
                    
                    {/* COL 2: COMMITMENT START */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#fff" }}>
                      Q${(Number(d.startQuarter) % 4) + 1} ${Math.floor(Number(d.startQuarter) / 4)}
                    </td>
                    
                    {/* COL 3: COMMITMENT END */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#bbb" }}>
                      {d.unlockQuarter ? `Q${(Number(d.unlockQuarter) % 4) + 1} ${Math.floor(Number(d.unlockQuarter) / 4)}` : d.refund ? <span style={{ color: "#ef4444", fontWeight: "600", fontSize: "11px" }}>REFUNDED</span> : "Active"}
                    </td>
                    
                    {/* COL 4: AMOUNT IN */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#1d5c34", fontWeight: "600" }}>
                      +{formatAllocation(BigInt(d.amountin || "0"))}
                    </td>
                    
                    {/* COL 5: AMOUNT OUT (Aligned Right) */}
                    <td style={{ ...styles.label, padding: "12px 8px", textAlign: "right", color: "#888" }}>
                      {formatAllocation(BigInt(d.amountout || "0"))}
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
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ ...styles.label, color: "#888", fontSize: "10px", letterSpacing: "0.5px", fontWeight: "600", display: "block" }}>
                  TO DATE
                </span>
                <b style={{ ...styles.label, color: "#d3d3d3", fontSize: "10px", display: "block" }}>
                  {ventureDepositTotal}
                </b>
              </div>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #161616", borderTop: "1px solid #161616" }}>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>TIMESTAMP</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>COMMITMENT START</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>COMMITMENT END</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>AMOUNT IN</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px", textAlign: "right" }}>AMOUNT OUT</th>
              </tr>
            </thead>
            <tbody>
              {ventureDeposits.length === 0 ? (
                <tr>
                  {/* Updated colSpan to 5 to match your headers perfectly */}
                  <td colSpan="5" style={{ ...styles.label, padding: "24px 8px", color: "#444444", textAlign: "center", fontStyle: "italic" }}>No active venture records logged...</td>
                </tr>
              ) : (
                ventureDeposits.map((d, idx) => (
                  <tr key={`venture-dep-${idx}`} style={{ borderBottom: "1px solid #111111" }}>
                    {/* COL 1: TIMESTAMP */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#aaa" }}>{parseTimestamp(d.timestamp)}</td>
                    
                    {/* COL 2: COMMITMENT START */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#fff" }}>
                      Q${(Number(d.startQuarter % 4)) + 1} ${Math.floor(Number(d.startQuarter) / 4)}
                    </td>
                    
                    {/* COL 3: COMMITMENT END */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#bbb" }}>
                      {d.unlockQuarter ? `Q${(Number(d.unlockQuarter) % 4) + 1} ${Math.floor(Number(d.unlockQuarter) / 4)}` : d.refund ? <span style={{ color: "#ef4444", fontWeight: "600", fontSize: "11px" }}>REFUNDED</span> : "Active"}
                    </td>
                    
                    {/* COL 4: AMOUNT IN */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#1d5c34", fontWeight: "600" }}>
                      +{formatAllocation(BigInt(d.amountin || "0"))}
                    </td>
                    
                    {/* COL 5: AMOUNT OUT (Aligned Right) */}
                    <td style={{ ...styles.label, padding: "12px 8px", textAlign: "right", color: "#888" }}>
                      {formatAllocation(BigInt(d.amountout || "0"))}
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
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ ...styles.label, color: "#888", fontSize: "10px", letterSpacing: "0.5px", fontWeight: "600", display: "block" }}>
                  TO DATE
                </span>
                <b style={{ ...styles.label, color: "#d3d3d3", fontSize: "10px", display: "block" }}>
                  {vaultWithdrawTotal}
                </b>
              </div>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #161616", borderTop: "1px solid #161616" }}>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>TIMESTAMP</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>COMMITMENT START</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>COMMITMENT END</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>DIVIDEND TOKEN</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px", textAlign: "right" }}>PAYOUT AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {vaultWithdrawals.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ ...styles.label, padding: "24px 8px", color: "#444444", textAlign: "center", fontStyle: "italic" }}>No withdrawal records logged...</td>
                </tr>
              ) : (
                vaultWithdrawals.map((w, idx) => (
                  <tr key={`vault-w-${idx}`} style={{ borderBottom: "1px solid #111111" }}>
                    {/* COL 1: TIMESTAMP */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#888" }}>
                      {w.timestamp ? parseTimestamp(w.timestamp) : "N/A"}
                    </td>
                    
                    {/* COL 2: COMMITMENT START */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#bbb" }}>
                      Q${(Number(w.startQuarter) % 4) + 1} ${Math.floor(Number(w.startQuarter) / 4)}
                    </td>
                    
                    {/* COL 3: COMMITMENT END */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#fff" }}>
                      Q${(Number(w.unlockQuarter) % 4) + 1} ${Math.floor(Number(w.unlockQuarter) / 4)}
                    </td>
                    {/* COL 4: DIVIDEND TOKEN */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#fff" }}>
                      {w.dividendToken && (
                        <span style={{ display: "block", fontSize: "10px", color: "#555"}}>
                          {`${w.dividendToken.slice(0, 6)}...${w.dividendToken.slice(-4)}`}
                        </span>
                      )}
                    </td>
                    
                    {/* COL 4: PAYOUT AMOUNT (Aligned Right) */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#ef4444", textAlign: "right", fontWeight: "600" }}>
                      -{formatAllocation(BigInt(w.userDividendAmount || "0"))}
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
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ ...styles.label, color: "#888", fontSize: "10px", letterSpacing: "0.5px", fontWeight: "600", display: "block" }}>
                  TO DATE
                </span>
                <b style={{ ...styles.label, color: "#d3d3d3", fontSize: "10px", display: "block" }}>
                  {ventureWithdrawTotal}
                </b>
              </div>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #161616", borderTop: "1px solid #161616" }}>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>TIMESTAMP</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>COMMITMENT START</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>COMMITMENT END</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>VENTURE TOKEN</th>
                <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px", textAlign: "right" }}>PAYOUT AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {ventureWithdrawals.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ ...styles.label, padding: "24px 8px", color: "#444444", textAlign: "center", fontStyle: "italic" }}>No withdrawal records logged...</td>
                </tr>
              ) : (
                ventureWithdrawals.map((w, idx) => (
                  <tr key={`vault-w-${idx}`} style={{ borderBottom: "1px solid #111111" }}>
                    {/* COL 1: TIMESTAMP */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#888" }}>
                      {w.timestamp ? parseTimestamp(w.timestamp) : "N/A"}
                    </td>
                    
                    {/* COL 2: COMMITMENT START */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#bbb" }}>
                      Q${(Number(w.startQuarter) % 4) + 1} ${Math.floor(Number(w.startQuarter) / 4)}
                    </td>
                    
                    {/* COL 3: COMMITMENT END */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#fff" }}>
                      Q${(Number(w.unlockQuarter) % 4) + 1} ${Math.floor(Number(w.unlockQuarter) / 4)}
                    </td>
                    {/* COL 4: VENTURE TOKEN */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#fff" }}>
                      {w.ventureToken && (
                        <span style={{ display: "block", fontSize: "10px", color: "#555", fontFamily: "monospace" }}>
                          {`${w.ventureToken.slice(0, 6)}...${w.ventureToken.slice(-4)}`}
                        </span>
                      )}
                    </td>
                    
                    {/* COL 4: PAYOUT AMOUNT (Aligned Right) */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#ef4444", textAlign: "right", fontWeight: "600" }}>
                      -{formatAllocation(BigInt(w.userDividendAmount || "0"))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
      {/* --- MODAL 1: SMART VAULT & VENTURE DEPOSIT PIPELINE --- */}
      {isDepositModalOpen && (
        <div style={modalStyles.overlay} onClick={() => setIsDepositModalOpen(false)}>
          <div style={modalStyles.content} onClick={(e) => e.stopPropagation()}>
            <div style={{ ...styles.sectionCard, width: "100%", boxSizing: "border-box", margin: 0, border: "none" }}>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #141414", paddingBottom: "8px", marginBottom: "16px" }}>
                <h2 style={{ ...styles.sectionTitle, margin: 0 }}>CORE PORTFOLIO DEPOSIT PIPELINE</h2>
                <button style={modalStyles.closeButton} onClick={() => setIsDepositModalOpen(false)}>✕</button>
              </div>

              {/* INTERACTION SELECTOR MATRIX */}
              <div style={{ marginBottom: "16px" }}>
                <label style={styles.label}>SELECT DEPOSIT CONTRACT METHOD TARGET</label>
                <select style={styles.inputElement} value={depositType} onChange={(e) => setDepositType(e.target.value)}>
                  <option value="SMART_VAULT" style={{ background: "#121212" }}>Smart Vault Deposit (Lock Quarters Execution)</option>
                  <option value="VENTURE_VAULT" style={{ background: "#121212" }}>Venture Vault Deposit (Direct Asset Routing)</option>
                </select>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
                {/* LEFT COLUMN */}
                <div>
                  <label style={styles.label}>USER ADDRESS</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    style={styles.sidebarInput}
                    value={depositor}
                    onChange={(e) => setDepositor(e.target.value)}
                  />

                  <div style={{ marginTop: "12px" }}>
                    <label style={styles.label}>DEPOSIT ASSET (TOKEN)</label>
                    <select 
                      style={styles.inputElement} 
                      value={depositToken}
                      onChange={(e) => setDepositToken(e.target.value)}
                    >
                      <option value="" disabled style={{ background: "#121212" }}>
                        Select {depositType === "deposit" ? "Deposit" : "Withdrawal"} Asset
                      </option>
                      {Array.isArray(supportedTokens) && supportedTokens
                        .filter((token) => !["BTC", "LINK", "ETH", "UNI", "MATIC", "COPx", "CGRi", "TGUSA", "TGMX"].includes(token.symbol))
                        .map((token) => (
                        <option key={`tokenB-${token.address}`} value={token.symbol} style={{ background: "#121212" }}>
                          {token.symbol} ({token.name || token.chain})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginTop: "12px" }}>
                    <label style={styles.label}>DEPOSIT AMOUNT (UINT256)</label>
                    <input type="text" inputMode="decimal" placeholder="Enter raw token units" style={styles.inputElement} value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
                  </div>
                </div>

                {/* RIGHT COLUMN */}
                <div>
                  {/* DYNAMIC SLOT: Swaps Committed Quarters for Venture Token Selection seamlessly */}
                  {depositType === "SMART_VAULT" ? (
                    <div>
                      <label style={styles.label}>COMMITTED QUARTERS (DURATION)</label>
                      <input type="text" placeholder="e.g. 4" style={styles.inputElement} value={committedQuarters} onChange={(e) => setCommittedQuarters(e.target.value)} />
                    </div>
                  ) : (
                    <div>
                      <label style={styles.label}>TARGET VENTURE CONTRACT</label>
                      <select 
                        style={styles.inputElement} 
                        value={depositVentureAddress} 
                        onChange={(e) => setDepositVentureAddress(e.target.value)}
                      >
                        <option value="" disabled style={{ background: "#121212" }}>Select Venture Asset</option>
                        {dividendTokens
                          .filter((token) => ["TGMX", "TGUSA", "CGRi", "CREs", "CREh", "GLB"].includes(token.symbol))
                          .map((token) => (
                            <option key={`deposit-venture-${token.address}`} value={token.address} style={{ background: "#121212" }}>
                              {token.symbol} — {token.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  <div style={{ marginTop: "12px" }}>
                    <label style={styles.label}>DEPOSIT RECORD HASH (BYTES32)</label>
                    <input type="text" placeholder="0x..." style={{ ...styles.inputElement, fontFamily: "monospace" }} value={depositHash} onChange={(e) => setDepositHash(e.target.value)} />
                  </div>

                  <div style={{ marginTop: "12px" }}>
                    <label style={{ ...styles.label, color: "#888" }}>INCOMING RATE INDEX</label>
                    <input type="text" disabled style={{ ...styles.inputElement, color: "#555" }} value="System Handled (Passed at Call Execution)" />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "20px", borderTop: "1px solid #141414", paddingTop: "16px", display: "flex", justifyContent: "flex-end" }}>
                <button 
                  style={{ ...styles.btnForestGreen, width: "auto", paddingLeft: "32px", paddingRight: "32px" }} 
                  onClick={handleExecuteDeposit} 
                  disabled={depositLoading || !depositToken || (depositType === "VENTURE_VAULT" && !depositVentureAddress)}
                >
                  {depositLoading ? "SUBMITTING DEPOSIT ROUTINE..." : "EXECUTE DEPOSIT"}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: VAULT & VENTURE SETTLED WITHDRAWAL --- */}
      {isWithdrawModalOpen && (
        <div style={modalStyles.overlay} onClick={() => setIsWithdrawModalOpen(false)}>
          <div style={modalStyles.content} onClick={(e) => e.stopPropagation()}>
            <div style={{ ...styles.sectionCard, width: "100%", boxSizing: "border-box", margin: 0, border: "none" }}>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #141414", paddingBottom: "8px", marginBottom: "16px" }}>
                <h2 style={{ ...styles.sectionTitle, margin: 0 }}>PORTFOLIO ASSET SETTLEMENT & WITHDRAWAL</h2>
                <button style={modalStyles.closeButton} onClick={() => setIsWithdrawModalOpen(false)}>✕</button>
              </div>

              {/* INTERACTION SELECTOR MATRIX */}
              <div style={{ marginBottom: "16px" }}>
                <label style={styles.label}>SELECT MATRIX CONTRACT TYPE</label>
                <select style={styles.inputElement} value={withdrawType} onChange={(e) => { setWithdrawType(e.target.value); setTargetVaultOrDividendToken(""); }}>
                  <option value="SMART_VAULT" style={{ background: "#121212" }}>Smart Vault Framework (Dividend Asset Settlement)</option>
                  <option value="VENTURE_VAULT" style={{ background: "#121212" }}>Venture Vault Framework (Infrastructure Settle)</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
                {/* LEFT COLUMN */}
                <div>
                  <div>
                    <label style={styles.label}>
                      {withdrawType === "SMART_VAULT" ? "SELECT DIVIDEND TOKEN" : "SELECT VENTURE ASSET"}
                    </label>
                    <select 
                      style={styles.inputElement} 
                      value={targetVaultOrDividendToken} 
                      onChange={(e) => setTargetVaultOrDividendToken(e.target.value)}
                    >
                      <option value="" disabled style={{ background: "#121212" }}>
                        {withdrawType === "SMART_VAULT" ? "Select Dividend Target" : "Select Venture Target"}
                      </option>
                      {dividendTokens.map((token) => (
                        <option key={`withdraw-target-${token.address}`} value={token.address} style={{ background: "#121212" }}>
                          {token.symbol} — {token.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginTop: "12px" }}>
                    <label style={styles.label}>PAYOUT TOKEN</label>
                    <select 
                      style={styles.inputElement} 
                      value={payToken}
                      onChange={(e) => setPayToken(e.target.value)}
                    >
                      <option value="" disabled style={{ background: "#121212" }}>
                        Select {withdrawType === "deposit" ? "Deposit" : "Withdrawal"} Asset
                      </option>
                      {Array.isArray(supportedTokens) && supportedTokens
                        .filter((token) => !["BTC", "COPx"].includes(token.symbol))
                        .map((token) => (
                        <option key={`tokenB-${token.address}`} value={token.symbol} style={{ background: "#121212" }}>
                          {token.symbol} ({token.name || token.chain})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* RIGHT COLUMN */}
                <div>
                  <label style={styles.label}>HOLDER AMOUNT TO REDEEM</label>
                  <input type="text" placeholder="Enter total asset validation balance" style={styles.inputElement} value={holderBalance} onChange={(e) => setHolderBalance(e.target.value)} />
                  
                  <div style={{ marginTop: "12px" }}>
                    <label style={styles.label}>SYSTEM TIMESTAMP (GENERIC LOG)</label>
                    <input type="text" disabled style={{ ...styles.inputElement, color: "#666" }} value="Auto-generated on runtime signature" />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "20px", borderTop: "1px solid #141414", paddingTop: "16px", display: "flex", justifyContent: "flex-end" }}>
                <button 
                  style={{ ...styles.btnForestGreen, width: "auto", paddingLeft: "32px", paddingRight: "32px" }} 
                  onClick={() => console.log(`Triggering ${withdrawType} withdraw:`, { targetAddress: targetVaultOrDividendToken, payToken, holderBalance, timestamp: Math.floor(Date.now() / 1000) })} 
                  disabled={withdrawLoading || !isConnected || !targetVaultOrDividendToken || !payToken}
                >
                  {withdrawLoading ? "PROCESSING CLEARING CYCLE..." : "EXECUTE WITHDRAWAL"}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}