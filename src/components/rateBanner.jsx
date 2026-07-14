import React, { useEffect, useState } from "react";
import { getExchangeRates } from "../utils/exchangeRates"; 
import { supportedTokens } from "../utils/tokensX"; 

const CoreRateBanner = () => {
  const [gbdoRates, setGbdoRates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        setLoading(true);
        const response = await getExchangeRates();

        // Defensively locate the rates array without injecting fake values
        const rawRates = response?.rates?.rates || response?.rates || [];

        if (Array.isArray(rawRates) && rawRates.length > 0) {
          const excludedSymbols = [
            "WBTC", "cbBTC", "ETH", "LINK", "UNI", "MATIC", "BRZ", "MMXN", 
            "AUDD", "AUDT", "NGNT", "COPX", "GLB", "TGUSA", "TGMX", "CRES", "CREH", "CGRi"
          ];

          const formattedRates = rawRates
            .filter(t => t?.symbol && !excludedSymbols.includes(t.symbol.toUpperCase()))
            .map(token => {
              const rateAgainstGBDo = token.rateAgainstGBDo ?? token.rate;
              if (rateAgainstGBDo === undefined || rateAgainstGBDo === null) return null;
              
              const cleanSymbol = token.symbol.toUpperCase();
              const numericRate = Number(rateAgainstGBDo);

              if (isNaN(numericRate)) return null;

              return `${cleanSymbol} ${numericRate.toFixed(4)} | GBDo`;
            })
            .filter(rate => rate !== null);

          setGbdoRates(formattedRates);
        } else {
          setGbdoRates([]);
        }
      } catch (error) {
        console.error("Error fetching exchange rates for banner:", error);
        setGbdoRates([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRates();
    const interval = setInterval(fetchRates, 300000);
    return () => clearInterval(interval);
  }, []);

  if (loading && gbdoRates.length === 0) {
    return (
      <div style={{
        width: "100%",
        backgroundColor: "#000000",
        color: "#6b7280",
        fontSize: "12px",
        padding: "8px 0",
        textAlign: "center",
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        flexShrink: 0
      }}>
        Loading Exchange Rates...
      </div>
    );
  }

  // If the query fails or filters down to zero active assets, exit silently
  if (gbdoRates.length === 0) return null;

  return (
    <div style={{
      width: "100%",
      backgroundColor: "#000000",
      borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
      overflow: "hidden",
      position: "relative",
      display: "flex",
      alignItems: "center",
      height: "36px",
      flexShrink: 0,
      zIndex: 50
    }}>
      <div className="animate-scroll-track" style={{
        whiteSpace: "nowrap",
        display: "inline-flex",
        padding: "8px 0"
      }}>
        {[...gbdoRates, ...gbdoRates].map((rate, idx) => (
          <span key={idx} style={{
            marginRight: "48px",
            fontSize: "12px",
            fontWeight: 300,
            letterSpacing: "0.05em",
            color: "#d1d5db"
          }}>
            {rate}
          </span>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scrollRates {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        .animate-scroll-track {
          display: inline-flex;
          animation: scrollRates 40s linear infinite;
        }

        .animate-scroll-track:hover {
          animation-play-state: paused;
        }
      `}} />
    </div>
  );
};

export default CoreRateBanner;