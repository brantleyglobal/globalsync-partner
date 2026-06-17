import { D1Database } from '@cloudflare/workers-types';

type EnvBindings = {
  DB_TRANSACTIONHISTORY: D1Database;
  DB_TRANSFERS: D1Database;
  DB_VAULT: D1Database;
  DB_PURCHASE: D1Database;
  DB_SWAP: D1Database;
  DB_REDEMPTIONS: D1Database;
  API_SECRET: string;
};

declare namespace Cloudflare {
  interface Env extends EnvBindings {}
}