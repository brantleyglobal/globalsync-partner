import { useEffect, useState } from "react";
import { Address, createPublicClient, http } from "viem";
import { erc20Abi } from "viem";
import { supportedTokens, dividendTokens } from "./tokensX";
import { deployments } from "./deploymentsX";
import type { PublicClient } from "viem";
import { GLOBALCHAIN } from "./customChains";
import { polygon, mainnet } from "viem/chains";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
    };
  }
}

type TokenBalance = {
  symbol: string;
  address: Address;
  decimals: number;
  balance: bigint;
  isNative?: boolean;
  chain?: keyof typeof chainClients;
};

type Token = {
  name: string;
  symbol: string;
  address: Address;
  decimals: number;
  isNative?: boolean;
  chain: keyof typeof chainClients;
};

type NormalizedToken = Omit<Token, "isNative"> & { isNative: boolean };

function normalizeTokens(tokens: Token[]): NormalizedToken[] {
  return tokens.map(token => ({
    ...token,
    isNative: token.isNative ?? false,
  }));
}

const nativeToken: NormalizedToken = {
  name: GLOBALCHAIN.nativeCurrency.name,
  symbol: GLOBALCHAIN.nativeCurrency.symbol,
  address: "0x0000000000000000000000000000000000000000",
  decimals: GLOBALCHAIN.nativeCurrency.decimals,
  isNative: true,
  chain: "global",
};

// 1. Collect all raw addresses into a standard flat array first
const rawAddresses = [
  nativeToken.address,
  deployments?.BGSellRE,
  deployments?.BGHoldRE,
  deployments?.TGMxRenewable,
  deployments?.TGUsRenewable,
  deployments?.Globe,
  ...dividendTokens.map(t => t.address)
].flat(); // .flat() removes any accidental nested arrays

// 2. Filter out anything that isn't a string, and explicitly cast them all as clean viem Addresses
const cleanAddresses: Address[] = rawAddresses
  .filter((addr): addr is string => typeof addr === 'string')
  .map(addr => addr as Address);

// 3. Hand the perfectly typed, flat array directly to your Set
const myChainSupportedTokenAddresses = new Set<Address>(cleanAddresses);

const allTokens: Token[] = [
  ...dividendTokens.map(t => ({
    ...t,
    address: t.address as Address,
    isNative: false,
    chain: "global" as const,
  })),
  ...supportedTokens.map(t => {
    // Cast the check so the Set can read it safely
    const tokenAddress = t.address as Address; 

    const chain: keyof typeof chainClients =
      myChainSupportedTokenAddresses.has(tokenAddress) ? "global" :
      t.symbol === "MATIC" ? "polygon" : "ethereum";

    return {
      ...t,
      address: tokenAddress,
      isNative: t.isNative ?? false,
      chain,
    };
  }),
];

const defaultClient = createPublicClient({
  chain: GLOBALCHAIN,
  transport: http('https://rpc.brantley-global.com'),
});

// Explicitly enforce the PublicClient type on the record
const chainClients: Record<"global" | "ethereum" | "polygon", PublicClient> = {
  global: createPublicClient({
    chain: GLOBALCHAIN,
    transport: http("https://rpc.brantley-global.com"),
  }),
  ethereum: createPublicClient({
    chain: mainnet,
    transport: http("https://1rpc.io/eth"),
  }),
  polygon: createPublicClient({
    chain: polygon,
    transport: http("https://polygon-rpc.com"),
  }),
};

export const useDirectTokenBalances = (
  externalAddress?: Address,
  externalClient?: PublicClient
) => {
  const [userAddress, setUserAddress] = useState<Address | undefined>(externalAddress);
  const client: PublicClient = externalClient ?? defaultClient;
  const [balances, setBalances] = useState<TokenBalance[]>([]);

  useEffect(() => {
    async function resolveAddress() {
      if (externalAddress) return; // already provided
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: "eth_accounts" });
          if (accounts.length > 0) {
            setUserAddress(accounts[0] as Address);
          }
        } catch (err) {
          console.error("Failed to get wallet address:", err);
        }
      }
    }

    resolveAddress();
  }, [externalAddress]);

  useEffect(() => {
    if (!userAddress || !client) return;

    async function fetchBalancesForTokens(
      tokens: NormalizedToken[],
      client: PublicClient,
      address: Address
    ): Promise<TokenBalance[]> {
      const results = await Promise.allSettled(
        tokens.map(async token => {
          const balance = token.isNative
            ? await client.getBalance({ address })
            : await client.readContract({
                address: token.address,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: [address],
              });

          return {
            symbol: token.symbol,
            address: token.address,
            decimals: token.decimals,
            balance,
            isNative: token.isNative,
            chain: token.chain,
          };
        })
      );

      return results
        .filter(r => r.status === "fulfilled")
        .map(r => (r as PromiseFulfilledResult<TokenBalance>).value)
        .filter(token => token.balance > 0n);
    }

    async function fetchAllBalances() {
      const groupedTokens: Record<keyof typeof chainClients, NormalizedToken[]> = {
        global: [],
        ethereum: [],
        polygon: [],
      };

      for (const token of normalizeTokens(allTokens)) {
        const chainKey = token.chain;
        // Ensure the chain key actually exists on your groupedTokens object
        if (chainKey in groupedTokens) {
            groupedTokens[chainKey as keyof typeof chainClients].push(token);
        }
      }

      const balancePromises = Object.entries(groupedTokens).map(
        async ([chainKey, tokens]) => {
          try {
            const client = chainClients[chainKey as keyof typeof chainClients];
            return await fetchBalancesForTokens(tokens, client, userAddress!);
          } catch (err) {
            console.error(`Error fetching balances for ${chainKey}:`, err);
            return [];
          }
        }
      );

      const allResults = await Promise.all(balancePromises);
      const mergedBalances = allResults.flat();
      setBalances(mergedBalances);
    }

    fetchAllBalances();
  }, [userAddress]);

  return { balances };
};
