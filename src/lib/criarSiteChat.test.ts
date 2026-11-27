import { describe, it, expect } from "vitest";
import { respostaBot, resumoUsuario, type Mensagem } from "./criarSiteChat";

describe("criarSiteChat", () => {
  describe("respostaBot", () => {
    it("pede mais detalhes para texto curto", () => {
      expect(respostaBot(1, "oi")).toMatch(/aprofundar|referência/i);
      expect(respostaBot(1, "x".repeat(24))).toMatch(/aprofundar|referência/i);
    });

    it("confirma base para texto longo", () => {
      expect(respostaBot(1, "x".repeat(25))).toContain("Perfeito");
    });
  });

  describe("resumoUsuario", () => {
    it("junta só mensagens do utilizador", () => {
      const lista: Mensagem[] = [
        { id: "1", papel: "bot", texto: "hi" },
        { id: "2", papel: "user", texto: "  A  " },
        { id: "3", papel: "user", texto: "B" },
      ];
      expect(resumoUsuario(lista)).toBe("A\n\nB");
    });

    it("lista vazia de user dá string vazia", () => {
      expect(resumoUsuario([{ id: "1", papel: "bot", texto: "x" }])).toBe("");
    });
  });
});
