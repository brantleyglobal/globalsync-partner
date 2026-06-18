import { useEffect, useState } from "react";
import { Address } from "viem";

export const useDirectTokenBalances = (externalAddress?: Address) => {
  const [balances, setBalances] = useState<any[]>([]);

  useEffect(() => {
    if (!externalAddress || externalAddress.trim() === "") {
      setBalances([]);
      return;
    }

    async function updateDashboardBalances() {
      try {
        // Safe context checking to prevent web/dev server crashes
        if (typeof window !== "undefined" && (window as any).electronAPI) {
          const liveBalances = await (window as any).electronAPI.fetchBalances(externalAddress);
          setBalances(liveBalances);
        }
      } catch (err) {
        console.error("Failed to read IPC pipeline stream:", err);
      }
    }

    updateDashboardBalances();
    
    // Poll the Node.js backend cache layers cleanly every 30 seconds
    const loopTracker = setInterval(updateDashboardBalances, 30000);
    return () => clearInterval(loopTracker);

  }, [externalAddress]);

  return { balances };
};