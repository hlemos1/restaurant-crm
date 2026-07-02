import { describe, it, expect, vi, afterEach } from "vitest";
import { buildAllowedOrigins } from "@/lib/cors";

describe("buildAllowedOrigins", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("inclui NEXT_PUBLIC_APP_URL quando configurada", () => {
    const origins = buildAllowedOrigins({
      NEXT_PUBLIC_APP_URL: "https://app.example.com",
      NODE_ENV: "production",
    });
    expect(origins).toContain("https://app.example.com");
    expect(origins).not.toContain("http://localhost:3000");
  });

  it("fallback localhost APENAS fora de producao", () => {
    const origins = buildAllowedOrigins({ NODE_ENV: "development" });
    expect(origins).toContain("http://localhost:3000");
  });

  it("em producao sem NEXT_PUBLIC_APP_URL, NAO adiciona localhost e loga erro", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const origins = buildAllowedOrigins({ NODE_ENV: "production" });

    expect(origins).not.toContain("http://localhost:3000");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain("NEXT_PUBLIC_APP_URL ausente em produção");
  });

  it("mantem os dominios fixos em qualquer ambiente", () => {
    for (const NODE_ENV of ["development", "production", "test"]) {
      const origins = buildAllowedOrigins({ NODE_ENV });
      expect(origins).toContain("https://redenexial.com");
      expect(origins).toContain("https://restaurant-crm-iota.vercel.app");
    }
  });
});
