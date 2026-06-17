import { D1Database } from '@cloudflare/workers-types';

export type EnvBindings = {
  DB_TRANSACTIONHISTORY: D1Database;
  DB_TRANSFERS: D1Database;
  DB_VAULT: D1Database;
  DB_PURCHASE: D1Database;
  DB_SWAP: D1Database;
  DB_REDEMPTIONS: D1Database;
};

export function DBService(env: EnvBindings) {
  return {
    transactionhistory: {
      async create(params: Record<string, any>) {
        const keys = [
          "txhash", "txtype", "sender", "token", "amount", "status", "chainstatus",
          "quarter", "processedat", "retrycount", "receipthash", "notes", "timestamp"
        ];
        const placeholders = keys.map(() => "?").join(", ");
        const values = keys.map(k => params[k]);

        await env.DB_TRANSACTIONHISTORY.prepare(`
          INSERT INTO transactionhistory (${keys.join(", ")})
          VALUES (${placeholders})
        `).bind(...values).run();
      },

      async get(params: { quarter: string; page?: number; pageSize?: number; sortBy?: string; sortOrder?: string }) {
        const { quarter, page = 1, pageSize = 10, sortBy = "timestamp", sortOrder = "desc" } = params;
        const query = `SELECT * FROM transactionhistory WHERE quarter = ? ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`;
        const values = [quarter, pageSize, (page - 1) * pageSize];
        const rows = await env.DB_TRANSACTIONHISTORY.prepare(query).bind(...values).all();
        return rows.results;
      }
    },

    transfers: {
      async create(params: Record<string, any>) {
        const keys = [
          "txhash", "contractaddress", "promise", "sender", "smartwallet",
          "recipient", "token", "amount", "status", "chainstatus", "queuedat",
          "processedat", "priority", "retrycount", "receipthash", "notes", "timestamp"
        ];
        const placeholders = keys.map(() => "?").join(", ");
        const values = keys.map(k => params[k]);

        await env.DB_TRANSFERS.prepare(`
          INSERT INTO transfers (${keys.join(", ")})
          VALUES (${placeholders})
        `).bind(...values).run();
      },

      async get(params: Record<string, any>) {
        const { useraddress, chainstatus, page = 1, pageSize = 10, sortBy = "timestamp", sortOrder = "desc" } = params;
        let query = `SELECT * FROM transfers`;
        const filters = [];
        const values: any[] = [];

        if (useraddress) {
          filters.push("(sender = ? OR recipient = ?)");
          values.push(useraddress, useraddress);
        }

        if (chainstatus !== undefined) {
          filters.push("chainstatus = ?");
          values.push(chainstatus);
        }

        if (filters.length) query += ` WHERE ${filters.join(" AND ")}`;
        query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`;
        values.push(pageSize, (page - 1) * pageSize);

        const rows = await env.DB_TRANSFERS.prepare(query).bind(...values).all();
        return rows.results;
      }
    },

    vault: {
      async get(params: Record<string, any>) {
        const { useraddress, depositstarttime, chainstatus, committedquarters } = params;
        let query = "";
        let value;

        if (useraddress) {
          query = `SELECT * FROM vault WHERE useraddress = ?`;
          value = useraddress;
        } else if (depositstarttime) {
          query = `SELECT * FROM vault WHERE depositstarttime = ?`;
          value = depositstarttime;
        } else if (committedquarters) {
          query = `SELECT * FROM vault WHERE committedquarters = ?`;
          value = committedquarters;
        } else if (chainstatus !== undefined) {
          query = `SELECT * FROM vault WHERE chainstatus = ?`;
          value = chainstatus;
        } else {
          throw new Error("Missing query parameter");
        }

        const rows = await env.DB_VAULT.prepare(query).bind(value).all();
        return rows.results;
      },

      async commit(params: Record<string, any>) {
        const keys = [
          "contractaddress", "useraddress", "depositamount", "paymentmethod",
          "ispending", "isclosed", "txhash", "depositstarttime",
          "promise", "status", "chainstatus", "timestamp", "queuedat", "processedat",
          "retrycount", "notes", "receipthash", "smartwallet", "committedquarters"
        ];
        await env.DB_VAULT.prepare(`
          INSERT INTO vault (${keys.join(", ")})
          VALUES (${keys.map(() => "?").join(", ")})
        `).bind(...keys.map(k => params[k])).run();
      }
    },

    purchases: {
      async record(params: Record<string, any>) {
        const keys = [
          "contractaddress", "useraddress", "asset", "amount", "quantity", "paymentmethod",
          "timestamp", "txhash", "promise", "status", "chainstatus",
          "queuedat", "processedat", "priority", "retrycount", "notes",
          "receipthash", "smartwallet"
        ];
        await env.DB_PURCHASE.prepare(`
          INSERT INTO purchases (${keys.join(", ")})
          VALUES (${keys.map(() => "?").join(", ")})
        `).bind(...keys.map(k => params[k])).run();
      },

      async get(params: Record<string, any>) {
        const { useraddress, chainstatus, page = 1, pageSize = 10, sortBy = "timestamp", sortOrder = "desc" } = params;
        let query = `SELECT * FROM purchases`;
        const filters = [];
        const values: any[] = [];

        if (useraddress) {
          filters.push("useraddress = ?");
          values.push(useraddress);
        } else if (chainstatus !== undefined) {
          filters.push("chainstatus = ?");
          values.push(chainstatus);
        }

        if (filters.length) query += ` WHERE ${filters.join(" AND ")}`;
        query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`;
        values.push(pageSize, (page - 1) * pageSize);

        const rows = await env.DB_PURCHASE.prepare(query).bind(...values).all();
        return rows.results;
      }
    },

    swaps: {
      async execute(params: Record<string, any>) {
        const keys = [
          "contractaddress", "useraddress", "selectedtoken", "direction", "amountin",
          "txhash", "promise", "status", "chainstatus", "timestamp", "amountout", "exchangerate",
          "queuedat", "processedat", "priority", "retrycount", "notes", "smartwallet"
        ];
        await env.DB_SWAP.prepare(`
          INSERT INTO swaps (${keys.join(", ")})
          VALUES (${keys.map(() => "?").join(", ")})
        `).bind(...keys.map(k => params[k])).run();
      },

      async get(params: Record<string, any>) {
        const { useraddress, chainstatus } = params;
        let query = "";
        let value;

        if (useraddress) {
          query = `SELECT * FROM swaps WHERE useraddress = ?`;
          value = useraddress;
        } else if (chainstatus !== undefined) {
          query = `SELECT * FROM swaps WHERE chainstatus = ?`;
          value = chainstatus;
        } else {
          throw new Error("Missing query parameter");
        }

        const rows = await env.DB_SWAP.prepare(query).bind(value).all();
        return rows.results;
      },

      async updateStatus(id: string, status: boolean) {
        await env.DB_SWAP.prepare(`
            UPDATE swaps SET chainstatus = ? WHERE id = ?
        `).bind(status, id).run();
        },

        async logError(id: string, notes: string) {
        await env.DB_SWAP.prepare(`
            UPDATE swaps SET notes = ?, retrycount = retrycount + 1 WHERE id = ?
        `).bind(notes, id).run();
        }
    },

    redemptions: {
      async redeem(params: Record<string, any>) {
        const keys = [
          "contractaddress", "useraddress", "vaultid", "amount", "paymentmethod",
          "timestamp", "txhash", "promise", "status", "chainstatus",
          "queuedat", "processedat", "priority", "retrycount", "notes",
          "receipthash", "smartwallet"
        ];
        await env.DB_REDEMPTIONS.prepare(`
          INSERT INTO redemptions (${keys.join(", ")})
          VALUES (${keys.map(() => "?").join(", ")})
        `).bind(...keys.map(k => params[k])).run();
      },

      async get(params: Record<string, any>) {
        const { useraddress, chainstatus } = params;
        let query = "";
        let value;

        if (useraddress) {
          query = `SELECT * FROM redemptions WHERE useraddress = ?`;
          value = useraddress;
        } else if (chainstatus !== undefined) {
          query = `SELECT * FROM redemptions WHERE chainstatus = ?`;
          value = chainstatus;
        } else {
          throw new Error("Missing query parameter");
        }

        const rows = await env.DB_REDEMPTIONS.prepare(query).bind(value).all();
        return rows.results;
      }
    }
  };
}
