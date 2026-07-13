import React from 'react';
import { styles } from '../../utils/styles.jsx';
import { supportedTokens } from '../../utils/tokensX.js';
import { Info, Close } from "@mui/icons-material";

export default function PurchaseStep({
  genData,
  selectedAssetKey,
  setSelectedAssetKey,
  selectedPanelKey,
  setSelectedPanelKey,
  selectedVoltage,
  setSelectedVoltage,
  selectedFrequency,
  setSelectedFrequency,
  selectedPhase,
  setSelectedPhase,
  selectedReactor,
  setSelectedReactor,
  selectedGridTieKey,
  setSelectedGridTieKey,
  selectedMonitoringKey,
  setSelectedMonitoringKey,
  selectedStableTokenSymbol,
  setSelectedStableTokenSymbol,
  setSelectedTokenAddress,
  buyerWalletAddress,
  setBuyerWalletAddress,
  quantity,
  setSelectedQuantity,
  email,
  handleEmailChange,
  handleEmailBlur,
  emailError,
  firstname,
  setFirstname,
  lastname,
  setLastname,
  address,
  setAddress,
  city,
  setCity,
  state,
  setState,
  phone,
  setPhone,
  postalCode,
  setPostalCode,
  selectedCountryKey,
  setSelectedCountryKey,
  purchaseTxHash,
  setPurchaseTxHash,
  onPrevious,
  handlePurchase,
  onHelpToggle,
  onClose
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      {/* Header Context */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3 style={{ ...styles.sectionTitle, margin: 0, letterSpacing: "1px" }}>PURCHASE REQUEST</h3>
        
        {/* Header Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={onHelpToggle} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", display: "flex", alignItems: "center", padding: "4px" }}>
            <Info style={{ fontSize: "18px" }} />
          </button>
          
          <button
            onClick={onClose}
            aria-label="Close portal modal"
            style={{ background: "none", border: "none", color: "#666", cursor: "pointer", display: "flex", alignItems: "center", padding: "4px", transition: "color 0.2s" }}
            onMouseEnter={(e) => e.currentTarget.style.color = "#fff"}
            onMouseLeave={(e) => e.currentTarget.style.color = "#666"}
          >
            <Close style={{ fontSize: "18px" }} />
          </button>
        </div>
      </div>

      {/* CONFIGURATION GRID */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <label style={styles.label}>SELECT MODEL (Required)</label>
          <select 
            style={styles.inputElement} 
            value={selectedAssetKey} 
            onChange={(e) => {
              setSelectedAssetKey(e.target.value);
              setSelectedPanelKey("");
              setSelectedGridTieKey("");
              setSelectedMonitoringKey("");
              setSelectedCountryKey("");
            }}
          >
            <option value="">Unit Model</option>
            {Object.keys(genData).map(key => (
              <option key={key} value={key}>{key} (ID: {genData[key].assetId})</option>
            ))}
          </select>
        </div>
        <div>
          <label style={styles.label}>PANEL CONFIGURATION</label>
          <select 
            style={styles.inputElement} 
            disabled={!selectedAssetKey}
            value={selectedPanelKey} 
            onChange={(e) => setSelectedPanelKey(e.target.value)}
          >
            <option value="">Output Customization</option>
            {selectedAssetKey && Object.keys(genData[selectedAssetKey].panel).map(key => (
              <option key={key} value={key}>{genData[selectedAssetKey].panel[key].label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* DYNAMIC EXPANSION PANEL */}
      {selectedAssetKey && selectedPanelKey && genData[selectedAssetKey].panel[selectedPanelKey]?.label === "Customize" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px", padding: "12px", background: "#0a0a0a", borderRadius: "6px", border: "1px dashed #222" }}>
          <div>
            <label style={styles.label}>VOLTAGE</label>
            <input type="number" style={styles.inputElement} value={selectedVoltage} onChange={(e) => setSelectedVoltage(e.target.value)} placeholder="240" />
          </div>
          <div>
            <label style={styles.label}>FREQUENCY</label>
            <select style={styles.inputElement} value={selectedFrequency} onChange={(e) => setSelectedFrequency(e.target.value)}>
              <option value="60Hz">60Hz</option>
              <option value="50Hz">50Hz</option>
            </select>
          </div>
          <div>
            <label style={styles.label}>PHASE TYPE</label>
            <select style={styles.inputElement} value={selectedPhase} onChange={(e) => setSelectedPhase(e.target.value)}>
              <option value="Single-Phase">Single-Phase</option>
              <option value="Split-Phase">Split-Phase</option>
              <option value="3-Phase">3-Phase</option>
            </select>
          </div>
          <div>
            <label style={styles.label}>LINE REACTOR</label>
            <select style={styles.inputElement} value={selectedReactor} onChange={(e) => setSelectedReactor(e.target.value)}>
              <option value="Default (None)">Default (None)</option>
              <option value="Line Reactor(s)">Line Reactor(s)</option>
            </select>
          </div>
        </div>
      )}

      {/* CORE ATTACHMENTS LAYER */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
        <div>
          <label style={styles.label}>GRID TIE INFRASTRUCTURE</label>
          <select style={styles.inputElement} disabled={!selectedAssetKey} value={selectedGridTieKey} onChange={(e) => setSelectedGridTieKey(e.target.value)}>
            <option value="">Power Rating</option>
            {selectedAssetKey && Object.keys(genData[selectedAssetKey].gridTie).map(key => (
              <option key={key} value={key}>{genData[selectedAssetKey].gridTie[key].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={styles.label}>INTEGRATED MONITORING</label>
          <select style={styles.inputElement} disabled={!selectedAssetKey} value={selectedMonitoringKey} onChange={(e) => setSelectedMonitoringKey(e.target.value)}>
            <option value="">Remote Monitoring</option>
            {selectedAssetKey && Object.keys(genData[selectedAssetKey].monitoring).map(key => (
              <option key={key} value={key}>{genData[selectedAssetKey].monitoring[key].label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* FINANCIAL LEDGER TARGETS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
        <div>
          <label style={styles.label}>STABLECOIN SETTLEMENT</label>
          <select 
            style={styles.inputElement} 
            value={selectedStableTokenSymbol} 
            onChange={(e) => {
              const symbol = e.target.value;
              setSelectedStableTokenSymbol(symbol);
              const tokenMeta = supportedTokens.find((t) => t.symbol === symbol);
              if (tokenMeta) setSelectedTokenAddress(tokenMeta.address);
            }}
          >
            <option value="">Payment Token</option>
            {supportedTokens
              .filter((t) => !["WBTC", "cbBTC", "ETH", "LINK", "UNI", "MATIC", "BRZ", "MMXN", "AUDD", "AUDT", "NGNT", "COPx", "GLB", "TGUSA", "TGMX", "CREs", "CREh", "CGRi"].includes(t.symbol))
              .map((t) => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
          </select>
        </div>
        <div>
          <label style={styles.label}>BUYER'S WALLET ADDRESS</label>
          <input type="text" placeholder="0x..." style={styles.inputElement} value={buyerWalletAddress} onChange={(e) => setBuyerWalletAddress(e.target.value)} />
        </div>
      </div>

      {/* QUANTITY AND LOGISTICS RECORD */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 3fr", gap: "12px", marginTop: "12px" }}>
        <div>
          <label style={styles.label}>QUANTITY</label>
          <input type="number" min="1" style={styles.inputElement} value={quantity || "1"} onChange={setSelectedQuantity} />
        </div>
        <div>
          <label style={styles.label}>DESTINATION EMAIL</label>
          <input type="email" placeholder="client@domain.com" style={{ ...styles.inputElement, borderColor: emailError ? "#ef4444" : "#1a1a1a" }} value={email} onChange={handleEmailChange} onBlur={handleEmailBlur} />
          {emailError && <span style={{ color: "#ef4444", fontSize: "11px", display: "block", marginTop: "4px" }}>{emailError}</span>}
        </div>
      </div>

      {/* PERSONAL PROFILE INTAKE */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
        <div>
          <label style={styles.label}>FIRST NAME</label>
          <input type="text" placeholder="John" style={styles.inputElement} value={firstname} onChange={(e) => setFirstname(e.target.value)} />
        </div>
        <div>
          <label style={styles.label}>LAST NAME</label>
          <input type="text" placeholder="Doe" style={styles.inputElement} value={lastname} onChange={(e) => setLastname(e.target.value)} />
        </div>
      </div>

      {/* SHIPPING STREET INFRASTRUCTURE */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
        <div style={{ gridColumn: "span 2" }}>
          <label style={styles.label}>SHIPPING STREET ADDRESS</label>
          <input type="text" placeholder="123 Global Dr" style={styles.inputElement} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div>
          <label style={styles.label}>CITY</label>
          <input type="text" placeholder="New York" style={styles.inputElement} value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div>
          <label style={styles.label}>STATE / PROVINCE</label>
          <input type="text" placeholder="NY" style={styles.inputElement} value={state} onChange={(e) => setState(e.target.value)} />
        </div>
        <div>
          <label style={styles.label}>PHONE NUMBER</label>
          <input 
            type="tel" 
            placeholder="+1 (555) 000-0000" 
            style={styles.inputElement} 
            value={phone} 
            onFocus={() => { if (!phone) setPhone("+"); }}
            onChange={setPhone} 
          />
        </div>
        <div>
          <label style={styles.label}>POSTAL / ZIP CODE</label>
          <input type="text" placeholder="10001" style={styles.inputElement} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
        <div>
          <label style={styles.label}>SHIPPING FREIGHT REGION</label>
          <select style={styles.inputElement} disabled={!selectedAssetKey} value={selectedCountryKey} onChange={(e) => setSelectedCountryKey(e.target.value)}>
            <option value="">Country/Region</option>
            {selectedAssetKey && Object.keys(genData[selectedAssetKey].countries).map(name => (
              <option key={name} value={name}>{name} (+{genData[selectedAssetKey].countries[name].toString()} days)</option>
            ))}
          </select>
        </div>
        <div>
          <label style={styles.label}>DEPOSIT TRANSACTION HASH</label>
          <input type="text" placeholder="0x..." style={styles.inputElement} value={purchaseTxHash} onChange={(e) => setPurchaseTxHash(e.target.value)} />
        </div>
      </div>

      {/* VALUATION BREAKDOWN VIEW */}
      {selectedAssetKey && selectedPanelKey && selectedGridTieKey && selectedMonitoringKey && (
        <div style={{ background: "#050505", padding: "12px", borderRadius: "6px", border: "1px solid #121212", marginTop: "12px", fontSize: "12px" }}>
          Base Price: <b>${genData[selectedAssetKey].price.toString()}</b> | Upcharges: <b style={{ color: "#1d5c34" }}>+${((genData[selectedAssetKey].panel[selectedPanelKey]?.price || 0n) + (genData[selectedAssetKey].gridTie[selectedGridTieKey]?.price || 0n) + (genData[selectedAssetKey].monitoring[selectedMonitoringKey]?.price || 0n)).toString()}</b>
        </div>
      )}

      {/* CONTROL ACTIONS FOOTER */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px", paddingTop: "12px", borderTop: "1px solid #111" }}>
        <button style={{ ...styles.btnForestGreen, background: "#333" }} onClick={onPrevious}>PREVIOUS</button>
        <button style={styles.btnForestGreen} onClick={handlePurchase}>SUBMIT PURCHASE ORDER</button>
      </div>
    </div>
  );
}