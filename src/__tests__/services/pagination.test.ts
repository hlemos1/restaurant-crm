import { describe, it, expect, beforeEach } from "vitest";
import { vi } from "vitest";

/**
 * Services de listagem paginados.
 *
 * Mock chainable do Drizzle: registra os metodos chamados na query builder
 * e resolve com linhas fake. Verifica:
 * - sem pagination: NAO aplica limit/offset (compat — lista completa)
 * - com pagination: aplica limit(n) e offset(n)
 * - count*: retorna numero a partir de count(*)
 */

interface RecordedCall {
  method: string;
  args: unknown[];
}

const { state } = vi.hoisted(() => ({
  state: {
    calls: [] as { method: string; args: unknown[] }[],
    rows: [] as unknown[],
  },
}));

vi.mock("@/db", () => {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(state.rows);
      }
      return (...args: unknown[]) => {
        state.calls.push({ method: String(prop), args });
        return proxy;
      };
    },
  };
  const proxy: object = new Proxy({}, handler);
  return { db: proxy };
});

import { getAllCustomers, countCustomers } from "@/services/customers";
import { getAllOrders, countOrders } from "@/services/orders";
import { getAllReservations, countReservations } from "@/services/reservations";
import { getAllBalances, countBalances } from "@/services/loyalty";
import { getNotifications, countNotifications } from "@/services/notifications";

function methodsCalled(): string[] {
  return state.calls.map((c: RecordedCall) => c.method);
}

function callArgs(method: string): unknown[] | undefined {
  return state.calls.find((c: RecordedCall) => c.method === method)?.args;
}

beforeEach(() => {
  state.calls = [];
  state.rows = [];
});

const PAGINATION = { limit: 25, offset: 50 };

describe.each([
  ["getAllCustomers", (p?: { limit: number; offset: number }) => getAllCustomers("t1", p)],
  ["getAllOrders", (p?: { limit: number; offset: number }) => getAllOrders("t1", p)],
  ["getAllReservations", (p?: { limit: number; offset: number }) => getAllReservations("t1", p)],
  ["getAllBalances", (p?: { limit: number; offset: number }) => getAllBalances("t1", p)],
  ["getNotifications", (p?: { limit: number; offset: number }) => getNotifications("t1", "u1", p)],
])("%s", (_name, invoke) => {
  it("sem pagination NAO aplica limit/offset (compat)", async () => {
    state.rows = [{ id: 1 }, { id: 2 }];
    const result = await invoke(undefined);

    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(methodsCalled()).not.toContain("limit");
    expect(methodsCalled()).not.toContain("offset");
  });

  it("com pagination aplica limit e offset no Drizzle", async () => {
    state.rows = [{ id: 51 }];
    const result = await invoke(PAGINATION);

    expect(result).toEqual([{ id: 51 }]);
    expect(callArgs("limit")).toEqual([25]);
    expect(callArgs("offset")).toEqual([50]);
  });
});

describe.each([
  ["countCustomers", () => countCustomers("t1")],
  ["countOrders", () => countOrders("t1")],
  ["countReservations", () => countReservations("t1")],
  ["countBalances", () => countBalances("t1")],
  ["countNotifications", () => countNotifications("t1", "u1")],
])("%s", (_name, invoke) => {
  it("retorna total numerico a partir de count(*)", async () => {
    state.rows = [{ count: "137" }];
    await expect(invoke()).resolves.toBe(137);
  });

  it("retorna 0 quando nao ha linhas", async () => {
    state.rows = [];
    await expect(invoke()).resolves.toBe(0);
  });
});
