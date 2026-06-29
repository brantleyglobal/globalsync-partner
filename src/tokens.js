// src/tokens.js
const deployments = require('./deployments.json');

const generateDividendTokens = () => {
  const tokens = [];
  for (let middle = 2; middle <= 8; middle++) {
    const maxDigit = (middle * 3) + 24;
    for (let fl = 1; fl <= maxDigit; fl++) {
      const name = `Dividend${fl}${middle}${fl}`;
      const symbol = `GBD${fl}${middle}${fl}`;
      const address = deployments[name];
      const displayName = `Global Dividend Terms--${middle}; `;

      if (!address) {
        throw new Error(`Missing deployment address for ${name}`);
      }

      tokens.push({
        name,
        symbol,
        address,
        decimals: 18,
        isNative: false,
        displayName,
        chain: "global",
        chainId: 38391207,
      });
    }
  }
  return tokens;
};

const supportedTokens = [
  {
    name: "USD Coin (Ethereum)",
    symbol: "USDC",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    isNative: false,
  },
  {
    name: "USD Coin (Base)",
    symbol: "USDC",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    isNative: false,
    chain: "base"
  },
  {
    name: "BlackRock USD Institutional Digital Liquidity Fund",
    symbol: "BUIDL",
    address: "0x7712c34205737192402172409a8F7ccef8aA2AEc",
    decimals: 6,
    isNative: false,
    chain: "ethereum"
  },
  {
    name: "Dai Stablecoin",
    symbol: "DAI",
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    decimals: 18,
    isNative: false,
    chain: "ethereum",
    chainId: 1,
  },
  {
    name: "Euro Coin",
    symbol: "EURC",
    address: "0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c",
    decimals: 6,
    isNative: false,
    chain: "ethereum",
    chainId: 1,
  },
  {
    name: "FraxUSD",
    symbol: "FRAX",
    address: "0x853d955aCEf822Db058eb8505911ED77F175b99e",
    decimals: 18,
    isNative: false,
    chain: "ethereum",
    chainId: 1,
  },
  {
    name: "PayPal USD",
    symbol: "PYUSD",
    address: "0x6c3ea9036406852006290770BEdFcAbA0e23A0e8",
    decimals: 6,
    isNative: false,
    chain: "ethereum",
    chainId: 1,
  },
  {
    name: "StraitsX Singapore Dollar",
    symbol: "XSGD",
    address: "0x70e8de73ce538da2beed35d14187f6959a8eca96",
    decimals: 6,
    isNative: false,
    chain: "ethereum",
    chainId: 1,
  },
  {
    name: "Pax Dollar",
    symbol: "USDP",
    address: "0x1456688345527bE1f37E9e627DA0837D6f08C925",
    decimals: 18,
    isNative: false,
    chain: "ethereum",
    chainId: 1,
  },
  {
    name: "Tether USD",
    symbol: "USDT",
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
    isNative: false,
    chain: "ethereum",
    chainId: 1,
  },
  {
    name: "BRZ Stablecoin",
    symbol: "BRZ",
    address: "0x71ab77b7dbb4fa7e017bc15090b2163221420282",
    decimals: 18,
    isNative: false,
    chain: "ethreum",
    chainId: 1,
  },
  {
    name: "Uniswap",
    symbol: "UNI",
    address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    decimals: 18,
    chain: "ethereum",
    chainId: 1,
  },
  {
    name: "Ethereum",
    symbol: "ETH",
    address: "0x0000000000000000000000000000000000000000",
    decimals: 18,
    chain: "ethereum",
    chainId: 1,
  },
  {
    name: "Chainlink",
    symbol: "LINK",
    address: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    decimals: 18,
    chain: "ethereum",
    chainId: 1,
  },
  {
    name: "Polygon",
    symbol: "MATIC",
    address: "0x0000000000000000000000000000000000001010",
    decimals: 18,
    chain: "polygon",
    chainId: 137,
  },
  {
    name: "Global Dollar",
    symbol: "GBDo",
    address: "0x0000000000000000000000000000000000000000",
    decimals: 18,
    isNative: true,
    chain: "global",
    chainId: 38391207,
  },
  {
    name: "Copian",
    symbol: "COPx",
    address: deployments.Copian,
    decimals: 18,
    isNative: false,
    chain: "global",
    chainId: 38391207,
  }
];

const dividendTokens = [
  ...generateDividendTokens(),
  {
    name: "The Globe",
    symbol: "GLB",
    address: deployments.Globe,
    decimals: 18,
    isNative: false,
    chain: "global",
    chainId: 38391207,
  },
  {
    name: "TRANS-GREENTECH REFINERY & DEPOT MX",
    symbol: "TGMX",
    address: deployments.TGMxRenewable,
    decimals: 18,
    isNative: false,
    chain: "global",
    chainId: 38391207,
  },
  {
    name: "TRANS-GREENTECH REFINERY & DEPOT US",
    symbol: "TGUSA",
    address: deployments.TGUsRenewable,
    decimals: 18,
    isNative: false,
    chain: "global",
    chainId: 38391207,
  },
  {
    name: "BG CLEAN GRID",
    symbol: "CGRi",
    address: deployments.BGGrid,
    decimals: 18,
    isNative: false,
    chain: "global",
    chainId: 38391207,
  },
  {
    name: "BG CLEAN REAL ESTATE",
    symbol: "CREs",
    address: deployments.BGSellRE,
    decimals: 18,
    isNative: false,
    chain: "global",
    chainId: 38391207,
  },
  {
    name: "BG CLEAN REAL ESTATE",
    symbol: "CREh",
    address: deployments.BGHoldRE,
    decimals: 18,
    isNative: false,
    chain: "global",
    chainId: 38391207,
  }
];

// Export clean JS arrays so main.js require hooks read them cleanly
module.exports = {
  supportedTokens,
  dividendTokens,
  generateDividendTokens
};
