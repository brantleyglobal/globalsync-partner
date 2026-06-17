import { DBService } from './src/db';
import { processSwap } from './handlers/swaps';
import { processTransfer } from './handlers/transfers';
//import { processRedemption } from './handlers/redemptions';
import { processPurchase } from './handlers/purchase';
import { processVault } from './handlers/vault';

import type { PurchasePayload } from './handlers/purchase';
/*import { SwapPayload } from './utils/payloads/swap';
import { TransferPayload } from './utils/payloads/transfer';
import { RedemptionsPayload } from './utils/payloads/redemptions';
import { PurchasePayload } from './utils/payloads/purchase';
import { VaultPayload } from './utils/payloads/vault';*/

// Type guards
/*function isSwapPayload(obj: unknown): obj is SwapPayload {
  return typeof obj === 'object' && obj !== null &&
    typeof (obj as any).id === 'string' &&
    typeof (obj as any).smartwallet === 'string' &&
    'promise' in obj;
}

function isTransferPayload(obj: unknown): obj is TransferPayload {
  return typeof obj === 'object' && obj !== null &&
    typeof (obj as any).txhash === 'string' &&
    typeof (obj as any).sender === 'string' &&
    typeof (obj as any).recipient === 'string';
}

function isRedemptionsPayload(obj: unknown): obj is RedemptionsPayload {
  return typeof obj === 'object' && obj !== null &&
    typeof (obj as any).vaultid === 'string' &&
    typeof (obj as any).useraddress === 'string';
}

function isPurchasePayload(obj: unknown): obj is PurchasePayload {
  return typeof obj === 'object' && obj !== null &&
    typeof (obj as any).useraddress === 'string' &&
    typeof (obj as any).asset === 'string';
}

/*function isVaultPayload(obj: unknown): obj is VaultPayload {
  return typeof obj === 'object' && obj !== null &&
    typeof (obj as any).useraddress === 'string' &&
    typeof (obj as any).depositstarttime === 'string';
}*/

// Define the shape of the DBService client
type DBClient = ReturnType<typeof DBService>;

async function runBundler(client: DBClient) {
  console.log(`[${new Date().toISOString()}] Starting hybrid bundler...`);

  // Swaps
  /*const swapResponse = await client.swaps.get({ chainstatus: false });
  const swaps: unknown[] = swapResponse.data;
  console.log(`Fetched ${swaps.length} swaps`);
  await processPayloads(swaps, isSwapPayload, processSwap);*/

  // Transfers
  /*const transferResponse = await client.transfers.get({ chainstatus: false });
  const transfers: unknown[] = transferResponse.data;
  console.log(`Fetched ${transfers.length} transfers`);
  await processPayloads(transfers, isTransferPayload, processTransfer);*/

  // Redemptions
  /*const redemptionResponse = await client.redemptions.get({ chainstatus: false });
  const redemptions: unknown[] = redemptionResponse.data;
  console.log(`Fetched ${redemptions.length} redemptions`);
  await processPayloads(redemptions, isRedemptionsPayload, processRedemption);*/

  // Purchases
  const purchaseResponse = await client.purchases.get({ chainstatus: false });
  const rawData = purchaseResponse.data as unknown[];

  // Type guard to validate each payload
  function isPurchasePayload(obj: any): obj is PurchasePayload {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      typeof obj.id === 'string' &&
      typeof obj.smartwallet === 'string' &&
      typeof obj.promise === 'string'
    );
  }

  // Filter valid purchases
  const purchases = rawData.filter(isPurchasePayload);

  console.log(`Fetched ${purchases.length} valid purchases`);

  for (const purchase of purchases) {
    try {
      const result = await processPurchase(purchase);

      if (result.success) {
        console.log(`Purchase ${purchase.id} processed: ${result.txhash}`);
      } else {
        console.warn(`Purchase ${purchase.id} failed: ${result.notes}`);
      }
    } catch (err) {
      console.error(`Error processing purchase ${purchase.id}:`, err);
    }
  }



  // Vaults
  /*const vaultResponse = await client.vault.get({ chainstatus: false });
  const vaults: unknown[] = vaultResponse;
  console.log(`Fetched ${vaults.length} vaults`);
  await processPayloads(vaults, isVaultPayload, processVault);*/

  console.log(`[${new Date().toISOString()}] Bundler run complete.`);
}

// Generic processor
async function processPayloads<T>(
  items: unknown[],
  validator: (obj: unknown) => obj is T,
  handler: (payload: T) => Promise<any>
) {
  const results = await Promise.allSettled(
    items.map((item, index) => {
      const id = (item as any)?.id || `#${index + 1}`;
      if (validator(item)) {
        console.log(`Valid payload detected: ${id}`);
        return handler(item);
      } else {
        console.warn(`Invalid payload skipped: ${id}`);
        return Promise.resolve(`Skipped invalid payload ${id}`);
      }
    })
  );

  results.forEach((result, index) => {
    const id = (items[index] as any)?.id || `#${index + 1}`;
    if (result.status === 'fulfilled') {
      console.log(`Processed ${id}:`, result.value);
    } else {
      console.error(`Failed ${id}:`, result.reason);
    }
  });
}

// Mock D1Database for local testing
function createMockDB(): D1Database {
  return {
    prepare: (query: string) => ({
      bind: (...values: any[]) => ({
        all: async () => ({ results: [] }),
        run: async () => ({ success: true }),
      }),
    }),
    batch: async () => [],
    exec: async () => ({ success: true }),
    withSession: async <T>(fn: (db: D1Database) => Promise<T>): Promise<T> => fn(createMockDB()),
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database;
}

// Entry point
(async () => {
  try {
    const dbBindings = {
      DB_TRANSACTIONHISTORY: createMockDB(),
      DB_TRANSFERS: createMockDB(),
      DB_VAULT: createMockDB(),
      DB_PURCHASE: createMockDB(),
      DB_REDEMPTIONS: createMockDB(),
      DB_SWAP: createMockDB(),
    };

    const client = DBService(dbBindings);
    await runBundler(client);
  } catch (err) {
    console.error('Fatal error running bundler:', err);
  }
})();
