// config.ts
import * as dotenv from "dotenv";
dotenv.config();

export const config = {
  bundlerUrl: process.env.BUNDLER_URL ?? "https://rpc.brantley-global.com",
  entryPoint: process.env.ENTRYPOINT_ADDRESS ?? "0xCd442314e8D6B8B9E2C5883c019098DE7be32313",
  batchSize: parseInt(process.env.BATCH_SIZE ?? "10"),
  chainId: parseInt(process.env.CHAIN_ID ?? "38391207"),
  network: process.env.NETWORK,
  logLevel: process.env.LOG_LEVEL
};
