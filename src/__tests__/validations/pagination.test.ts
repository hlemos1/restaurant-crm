import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import { paginationQuerySchema, parsePaginationParams } from "@/lib/validations/pagination";

describe("paginationQuerySchema", () => {
  it("aplica defaults page=1 limit=50", () => {
    const parsed = paginationQuerySchema.parse({});
    expect(parsed).toEqual({ page: 1, limit: 50 });
  });

  it("coage strings numericas da query string", () => {
    const parsed = paginationQuerySchema.parse({ page: "3", limit: "25" });
    expect(parsed).toEqual({ page: 3, limit: 25 });
  });

  it("rejeita limit acima de 100", () => {
    expect(() => paginationQuerySchema.parse({ limit: "101" })).toThrow(ZodError);
  });

  it("rejeita page < 1, zero e negativos", () => {
    expect(() => paginationQuerySchema.parse({ page: "0" })).toThrow(ZodError);
    expect(() => paginationQuerySchema.parse({ page: "-2" })).toThrow(ZodError);
    expect(() => paginationQuerySchema.parse({ limit: "0" })).toThrow(ZodError);
  });

  it("rejeita valores nao numericos e fracionados", () => {
    expect(() => paginationQuerySchema.parse({ page: "abc" })).toThrow(ZodError);
    expect(() => paginationQuerySchema.parse({ limit: "2.5" })).toThrow(ZodError);
  });
});

describe("parsePaginationParams", () => {
  it("retorna null sem params (modo compat — array puro)", () => {
    expect(parsePaginationParams(new URLSearchParams(""))).toBeNull();
    expect(parsePaginationParams(new URLSearchParams("foo=bar"))).toBeNull();
  });

  it("ativa paginacao com apenas page (limit default 50)", () => {
    expect(parsePaginationParams(new URLSearchParams("page=2"))).toEqual({
      page: 2,
      limit: 50,
      offset: 50,
    });
  });

  it("ativa paginacao com apenas limit (page default 1)", () => {
    expect(parsePaginationParams(new URLSearchParams("limit=10"))).toEqual({
      page: 1,
      limit: 10,
      offset: 0,
    });
  });

  it("calcula offset = (page - 1) * limit", () => {
    expect(parsePaginationParams(new URLSearchParams("page=4&limit=25"))).toEqual({
      page: 4,
      limit: 25,
      offset: 75,
    });
  });

  it("lanca ZodError para params invalidos (422 via handleApiError)", () => {
    expect(() => parsePaginationParams(new URLSearchParams("page=abc"))).toThrow(ZodError);
    expect(() => parsePaginationParams(new URLSearchParams("limit=9999"))).toThrow(ZodError);
  });
});
