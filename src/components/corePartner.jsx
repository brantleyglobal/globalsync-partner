// src/components/PartnerPortal.jsx
import React, { useState, useEffect } from 'react';
import { styles } from '../utils/styles.jsx';
import { deployments, supportedTokens } from '../utils/tokensX.js';
import { useRpcStatus } from "../utils/statusRpc";
import SelectionStep from "./steps/selectionStep.jsx";
import PurchaseStep from "./steps/purchaseStep.jsx";
import RepairStep from "./steps/repairStep.jsx";
import RefundStep from "./steps/refundStep.jsx";

export default function PartnerPortal({
  userAddress,
  activeContract,
  cumalativeChange,
  purchaseTxHash,
  setPurchaseTxHash,
  buyerWalletAddress,
  setBuyerWalletAddress,
  genData,
  quantity,
  setSelectedQuantity,
  selectedVoltage,
  setSelectedVoltage,
  selectedFrequency,
  setSelectedFrequency,
  selectedPhase,
  setSelectedPhase,
  selectedReactor,
  setSelectedReactor,
  selectedAssetKey,
  setSelectedAssetKey,
  selectedPanelKey,
  setSelectedPanelKey,
  selectedGridTieKey,
  setSelectedGridTieKey,
  selectedMonitoringKey,
  setSelectedMonitoringKey,
  selectedCountryKey,
  setSelectedCountryKey,
  selectedStableTokenSymbol,
  setSelectedStableTokenSymbol,
  setSelectedTokenAddress,
  firstname,
  setFirstname,
  lastname,
  setLastname,
  email,
  setEmail,
  phone,
  setPhone,
  postalCode,
  setPostalCode,
  address,
  setAddress,
  city,
  setCity,
  state,
  setState,
  handlePurchase,
  isConnected
}) {

  const rpcUp = useRpcStatus();
  const [partnerOrders, setPartnerOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [portalStep, setPortalStep] = useState(1);
  const [userAction, setUserAction] = useState(null);
  
  // High-level aggregate metrics for partner tracking
  const [metrics, setMetrics] = useState({
    totalVolume: 0,
    settledCost: 0,
    totalCredits: 0
  });

  const [emailError, setEmailError] = useState("");

  const validateEmail = (emailx) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailx);
  };

  // 1. Keeps the input snappy. Only clears errors while typing, never creates them.
  const handleEmailChange = (e) => {
    const emailx = e.target.value;
    setEmail(emailx);

    // If they clear the input, or type a valid string, clear any active error
    if (emailx === "" || validateEmail(emailx)) {
      setEmailError("");
    }
  };

  // 2. The critical "drop" check. Only throws an error when they step away.
  const handleEmailBlur = (e) => {
    const emailx = e.target.value;
    
    if (emailx === "") {
      setEmailError(""); // Optional: change to "Email is required" if it's mandatory
    } else if (!validateEmail(emailx)) {
      setEmailError("Please enter a valid email address");
    }
  };

  // Inside your PartnerPortal component in corePartner.jsx

  const [isActionProcessing, setIsActionProcessing] = useState(false);

  const handleProcessReturn = async (actionType) => {
    setIsActionProcessing(true);

    if (!purchaseTxHash || !purchaseTxHash.startsWith("0x")) {
      setIsActionProcessing(false);
      alert("Invalid target transaction receipt hash.");
      return;
    }

    try {
      // 1. Dispatch the contract mutation directly via the exposed preload API
      const response = await window.electronAPI.triggerVault({
        modeArg: "process-return-action",
        receipt: purchaseTxHash,
        actionType: actionType
      });

      if (response.status !== "Success") {
        setIsActionProcessing(false);
        alert(`On-chain execution failed: ${response.error || "Unknown error"}`);
        return;
      }

      const confirmedTxHash = response.data || purchaseTxHash;

      // 2. Dispatch the automated SMTP email confirmation directly after
      try {
        await window.electronAPI.triggerVault({
          modeArg: "send-smtp-email", // Or whatever key your preload maps to ipcMain 'send-smtp-email'
          firstname,
          lastname,
          email,
          userAddress,
          receipt: purchaseTxHash,
          tx: confirmedTxHash,
          actionType: actionType
        });
      } catch (smtpErr) {
        console.warn("Background notification email failed to dispatch:", smtpErr);
      }

      setIsActionProcessing(false);
      
      // Clean up modal state on success
      setIsPurchaseModalOpen(false);
      setPortalStep(1);

    } catch (err) {
      setIsActionProcessing(false);
      console.error("IPC Communication Pipeline failure:", err);
      alert(`Desktop channel failure: ${err.message}`);
    }
  };

  useEffect(() => {
    const fetchPartnerLedgerData = async () => {
      if (!userAddress || !isConnected) {
        setPartnerOrders([]);
        setMetrics({ totalVolume: 0, settledCost: 0, totalCredits: 0 });
        return;
      }
      
      setLoading(true);
      setError(null);

      try {
        let ledgerResponse = null;

        try {
          // Correctly call the backend IPC link handler
          ledgerResponse = await window.electronAPI.getPartnerLedger({
            userAddress,
            contractAddress: deployments.AssetPurchase, 
            chainKey: "global"
          });
        } catch (ipcError) {
          // Send the raw blockchain revert trace strictly to the developer console log
          console.warn("Partner ledger revert caught quietly. Initializing clean empty view:", ipcError);
          
          // Fallback to a mock empty ledger layout: [ [serializedTerms], [serializedCredits] ]
          ledgerResponse = [[], []];
        }

        if (!ledgerResponse || !Array.isArray(ledgerResponse)) {
          setPartnerOrders([]);
          return;
        }

        const [serializedTerms, serializedCredits] = ledgerResponse;

        let cumulativeVolume = 0;
        let cumulativeCost = 0n;
        let cumulativeCredits = 0n;

        // Map data arrays together
        const dynamicOrders = (serializedTerms || []).map((term, index) => {
          const rawAmount = BigInt(term.amount);
          const rawCredit = serializedCredits && serializedCredits[index] ? BigInt(serializedCredits[index]) : 0n;
          const orderQuantity = parseInt(term.quantity, 10) || 0;

          cumulativeVolume += orderQuantity;
          cumulativeCost += rawAmount;
          cumulativeCredits += rawCredit;

          return {
            id: term.id,
            index: index,
            date: term.timestamp && term.timestamp !== "0"
              ? new Date(Number(term.timestamp) * 1000).toISOString().split('T')[0] 
              : "N/A",
            quantity: orderQuantity,
            cost: `${formatAllocation(rawAmount)} GBDo`,
            hasCredit: rawCredit > 0n,
            manufacturerCredit: `${formatAllocation(rawCredit)} GBDo`,
            // Pass tracked elements down to layout arrays
            trackingNumber: term.trackingNumber || "Pending Assignment",
            txHash: term.purchaseTxHash
          };
        });

        setPartnerOrders(dynamicOrders);

        const scaleFactor = 1000000000000000000n; // 10^18

        setMetrics({
          totalVolume: cumulativeVolume,
          // Division extracts whole units, remainder extracts decimals safely
          settledCost: Number(cumulativeCost / scaleFactor) + Number(cumulativeCost % scaleFactor) / Number(scaleFactor),
          totalCredits: Number(cumulativeCredits / scaleFactor) + Number(cumulativeCredits % scaleFactor) / Number(scaleFactor)
        });

      } catch (err) {
        console.error("Partner ledger layout processing failed:", err);
        setError(err.message || "Failed to retrieve authorized native data arrays.");
      } finally {
        setLoading(false);
      }
    };

    fetchPartnerLedgerData();
  }, [userAddress, isConnected]);

  return (
    <div style={{ ...styles.mainContent, scrollbarWidth: "thin" }}>
      {/* GLOBAL SESSION STATUS BAR */}
      <div style={{ display: "flex", flexDirection: "column", width: "100%", boxSizing: "border-box" }}>
        
        {/* HEADER LAYER: Matched perfectly to the premium blueprint layout */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: "16px", marginBottom: "20px" }}>
          
          {/* Left Side: Clean Title */}
          <div>
            <h1 style={{ ...styles.label, color: "#ffffff", fontSize: "20px", fontWeight: "300", letterSpacing: "1px", margin: "0" }}>
              LIQUIDITY DESK
            </h1>
            <p style={{ color: "#555", fontSize: "11px", letterSpacing: "0.5px", margin: 0 }}>
              ADD ASSETS TO POOLS, MONITOR AMM STATISTICS & EARN REWARDS FROM PROTOCOL FEES
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

      {(!isConnected || loading) && (
        <div style={{ ...styles.jsonDisplay, color: "#054e1a", marginBottom: "30px", maxHeight: "none" }}>
          {loading && <div>Reading investment records...</div>}
          {!isConnected && <div>Ready to initialize. Connect your wallet to extract active purchase records.</div>}
        </div>
      )}

      {/* ACTION TRIGGERS BAR */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        {/* Trigger button mapped for the Asset Purchase structural form */}
        <button style={styles.btnForestGreen} onClick={() => setIsPurchaseModalOpen(true)}>
          PURCHASE HUB
        </button>
      </div>

      {/* METRIC SUMMARIES */}
      {isConnected && userAddress && (
        <div style={{ display: "flex", gap: "16px", marginBottom: "30px" }}>
          <div style={{ ...styles.sectionCard, flex: 1, padding: "16px", margin: 0 }}>
            <span style={{ ...styles.label, color: "#666", fontSize: "10px", letterSpacing: "1px", fontWeight: "lighter", display: "block", marginBottom: "6px" }}>CUMULATIVE VOLUME</span>
            <hr style={styles.divider} />
            <b style={{ fontSize: "16px",  fontWeight: "lighter", color: "#fff" }}>{metrics.totalVolume} <span style={{fontSize:"12px", fontWeight: "lighter", color:"#555"}}>UNITS</span></b>
          </div>
          <div style={{ ...styles.sectionCard, flex: 1, padding: "16px", margin: 0 }}>
            <span style={{ ...styles.label, color: "#666", fontSize: "10px", letterSpacing: "1px", fontWeight: "bold", display: "block", marginBottom: "6px" }}>GROSS SETTLEMENT VALUE</span>
            <hr style={styles.divider} />
            <b style={{ fontSize: "16px", fontWeight: "lighter", color: "#fff" }}>{metrics.settledCost.toFixed(2)} <span style={{fontSize:"12px", fontWeight: "lighter", color:"#555"}}>GBDo</span></b>
          </div>
          <div style={{ ...styles.sectionCard, flex: 1, padding: "16px", margin: 0, border: "1px solid rgba(74, 222, 128, 0.15)" }}>
            <span style={{ ...styles.label, color: "#1d5c34", fontSize: "10px", letterSpacing: "1px", fontWeight: "lighter", display: "block", marginBottom: "6px" }}>TOTAL RETURNED SAVINGS</span>
            <hr style={styles.divider} />
            <b style={{ fontSize: "16px", fontWeight: "lighter", color: "#1d5c34" }}>{metrics.totalCredits.toFixed(4)} <span style={{fontSize:"12px", fontWeight: "lighter", color:"#2e7d43"}}>GBDo</span></b>
          </div>
        </div>
      )}

      {/* VOLUME DISTRIBUTION REGISTER */}
      <div style={styles.sectionCard}>
        <h2 style={styles.sectionTitle}>Wholesale Partner Ledger</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #161616", borderTop: "1px solid #161616" }}>
              <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>PURCHASE RECORD</th>
              <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>TIMESTAMP</th>
              <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>CARRIER TRACKING</th>
              <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px", textAlign: "center" }}>QUANTITY</th>
              <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px", textAlign: "right" }}>SETTLEMENT COST</th>
              <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px", textAlign: "right" }}>BUYER CREDIT</th>
            </tr>
          </thead>
          <tbody>
            {partnerOrders.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ ...styles.label, padding: "30px 8px", color: "#444444", textAlign: "center", fontStyle: "italic" }}>
                  {loading ? "Decrypting partner allocation lines..." : "No operational activity recorded for the connected wallet."}
                </td>
              </tr>
            ) : (
              partnerOrders.map((order) => (
                <tr key={`partner-order-${order.id}-${order.index}`} style={{ borderBottom: "1px solid #111111" }}>
                  <td style={{ ...styles.label, padding: "12px 8px", color: "#888888" }}>PT-TERM-{order.index.toString().padStart(3, '0')}</td>
                  <td style={{ ...styles.label, padding: "12px 8px", color: "#aaaaaa" }}>{order.date}</td>
                  
                  {/* NEW CARRIER TRACKING DATA CELL */}
                  <td style={{ ...styles.label, padding: "12px 8px", color: order.trackingNumber === "Pending Assignment" ? "#555" : "#3b82f6", fontFamily: "monospace" }}>
                    {order.trackingNumber}
                  </td>

                  <td style={{ ...styles.label, padding: "12px 8px", textAlign: "center", color: "#bbb" }}>{order.quantity}</td>
                  <td style={{ ...styles.label, padding: "12px 8px", textAlign: "right", color: "#fff" }}>{order.cost}</td>
                  <td style={{ 
                    padding: "12px 8px", 
                    textAlign: "right", 
                    color: order.hasCredit ? "#1d5c34" : "#555555", 
                    fontWeight: order.hasCredit ? "600" : "normal" 
                  }}>
                    {order.hasCredit ? order.manufacturerCredit : "PENDING QUOTE ADJUSTMENT"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* ASSET PURCHASE MODAL OVERLAY */}
      {isPurchaseModalOpen && (
        <div 
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}
          onClick={() => {
            setIsPurchaseModalOpen(false);
            setPortalStep(1); // Reset configuration paths gracefully
          }}
        >
          <div 
            style={{ 
              ...styles.sectionCard, 
              width: "100%", 
              maxWidth: "680px", 
              maxHeight: "calc(100vh - 40px)",
              overflowY: "auto", 
              position: "relative", 
              padding: "24px",
              background: "#0d0d0d", 
              border: "1px solid #1a1a1a"
            }}
            onClick={(e) => e.stopPropagation()} 
          >
            {/* Dynamic Action Multi-Step Router Matrix Layout */}
            {portalStep === 1 && (
              <SelectionStep 
                userAction={userAction}
                setUserAction={setUserAction}
                onHelpToggle={() => console.log("Help context requested")}
                onNext={() => {
                  if (userAction === "purchase") setPortalStep(2);
                  else if (userAction === "repair") setPortalStep(3); // Route to repair component
                  else if (userAction === "refund") setPortalStep(4); // Route to refund component
                }}
              />
            )}

            {portalStep === 2 && userAction === "purchase" && (
              <PurchaseStep 
                genData={genData}
                selectedAssetKey={selectedAssetKey}
                setSelectedAssetKey={setSelectedAssetKey}
                selectedPanelKey={selectedPanelKey}
                setSelectedPanelKey={setSelectedPanelKey}
                selectedVoltage={selectedVoltage}
                setSelectedVoltage={setSelectedVoltage}
                selectedFrequency={selectedFrequency}
                setSelectedFrequency={setSelectedFrequency}
                selectedPhase={selectedPhase}
                setSelectedPhase={setSelectedPhase}
                selectedReactor={selectedReactor}
                setSelectedReactor={setSelectedReactor}
                selectedGridTieKey={selectedGridTieKey}
                setSelectedGridTieKey={setSelectedGridTieKey}
                selectedMonitoringKey={selectedMonitoringKey}
                setSelectedMonitoringKey={setSelectedMonitoringKey}
                selectedStableTokenSymbol={selectedStableTokenSymbol}
                setSelectedStableTokenSymbol={setSelectedStableTokenSymbol}
                setSelectedTokenAddress={setSelectedTokenAddress}
                buyerWalletAddress={buyerWalletAddress}
                setBuyerWalletAddress={setBuyerWalletAddress}
                quantity={quantity}
                setSelectedQuantity={setSelectedQuantity}
                email={email}
                handleEmailChange={handleEmailChange}
                handleEmailBlur={handleEmailBlur}
                emailError={emailError}
                firstname={firstname}
                setFirstname={setFirstname}
                lastname={lastname}
                setLastname={setLastname}
                address={address}
                setAddress={setAddress}
                city={city}
                setCity={setCity}
                state={state}
                setState={setState}
                phone={phone}
                setPhone={(e) => setPhone(e.target.value)} // Custom structural input assignment format
                postalCode={postalCode}
                setPostalCode={setPostalCode}
                selectedCountryKey={selectedCountryKey}
                setSelectedCountryKey={setSelectedCountryKey}
                purchaseTxHash={purchaseTxHash}
                setPurchaseTxHash={setPurchaseTxHash}
                onPrevious={() => setPortalStep(1)}
                handlePurchase={(e) => {
                  handlePurchase(e);
                  setIsPurchaseModalOpen(false);
                  setPortalStep(1);
                }}
                onHelpToggle={() => console.log("Display Purchase Help Menu")}
                onClose={() => setIsPurchaseModalOpen(false)}
              />
            )}
            
            {/* HARDWARE MAINTENANCE DIAGNOSTICS LOG STEP */}
            {portalStep === 3 && userAction === "repair" && (
              <RepairStep 
                receipt={purchaseTxHash}
                setReceipt={setPurchaseTxHash}
                firstname={firstname}
                setFirstname={setFirstname}
                lastname={lastname}
                setLastname={setLastname}
                email={email}
                handleEmailChange={handleEmailChange}
                handleEmailBlur={handleEmailBlur}
                emailError={emailError}
                onPrevious={() => setPortalStep(1)}
                onNext={async () => {
                  console.log("Submitting hardware repair manifest payloads...");
                  await handleProcessReturn("repair");
                }}
                isProcessing={isActionProcessing}
                isValidHash={purchaseTxHash && purchaseTxHash.startsWith("0x")}
                userAddress={userAddress}
                isConnected={isConnected}
                onHelpToggle={() => console.log("Repair instructions module text")}
                onClose={() => setIsPurchaseModalOpen(false)}
              />
            )}

            {/* FINANCIAL LEDGER RETURN SETTLEMENT STEP */}
            {portalStep === 4 && userAction === "refund" && (
              <RefundStep 
                receipt={purchaseTxHash}
                setReceipt={setPurchaseTxHash}
                firstname={firstname}
                setFirstname={setFirstname}
                lastname={lastname}
                setLastname={setLastname}
                email={email}
                handleEmailChange={handleEmailChange}
                handleEmailBlur={handleEmailBlur}
                emailError={emailError}
                onPrevious={() => setPortalStep(1)}
                onNext={async () => {
                  console.log("Submitting hardware repair manifest payloads...");
                  await handleProcessReturn("repair");
                }}
                isProcessing={isActionProcessing}
                isValidHash={purchaseTxHash && purchaseTxHash.startsWith("0x")}
                userAddress={userAddress}
                isConnected={isConnected}
                onHelpToggle={() => console.log("Refund parameters criteria terms text")}
                onClose={() => setIsPurchaseModalOpen(false)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}