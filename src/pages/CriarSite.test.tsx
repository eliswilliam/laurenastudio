import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CriarSite from "./CriarSite";

vi.mock("@/lib/publishApi", () => ({
  getPublishConfig: vi.fn(async () => ({ requireSlug: false })),
  postPublish: vi.fn(),
}));

vi.mock("@/lib/api", () => {
  let callCount = 0;
  return {
    default: {
      post: vi.fn(async (url: string, body: any) => {
        if (url === "/sites/chat") {
          callCount++;
          return {
            data: {
              project_id: "proj-test-123",
              reply: `Resposta do assistente #${callCount}`,
              message_count: callCount + 1,
            },
          };
        }
        if (url === "/sites/generate") {
          return {
            data: {
              project_id: body.project_id,
              status: "ready",
              preview_url: "/uploads/sites/proj-test-123/index.html",
              download_url: "/api/v1/sites/proj-test-123/download",
              message: "Site gerado com sucesso!",
            },
          };
        }
        throw new Error("Unknown endpoint");
      }),
    },
  };
});

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  localStorage.clear();
  sessionStorage.clear();
});

function renderPage(initialPath = "/criar-site") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/criar-site" element={<CriarSite />} />
        <Route path="/login" element={<div>Página login</div>} />
        <Route path="/editor" element={<div>Página editor</div>} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("CriarSite", () => {
  it("mostra ecrã inicial com titulo e ideias", () => {
    renderPage();
    expect(screen.getByText(/Crie o seu site/i)).toBeInTheDocument();
    expect(screen.getByText("Ideias para começar")).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /Prompt para descrever o site/i })
    ).toBeInTheDocument();
  });

  it("preenche prompt ao clicar numa sugestão", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Restaurante/i }));
    const ta = screen.getByRole("textbox", {
      name: /Prompt para descrever o site/i,
    }) as HTMLTextAreaElement;
    expect(ta.value.toLowerCase()).toContain("restaurante");
  });

  it("envia mensagem e mostra resposta do backend", async () => {
    const user = userEvent.setup();
    renderPage();
    const texto = "Quero um site para a minha agência de design com portfólio";
    const prompt = screen.getByRole("textbox", { name: /Prompt para descrever o site/i });
    await user.type(prompt, texto);
    await user.click(screen.getByRole("button", { name: /Enviar mensagem/i }));

    expect(screen.getByText(texto)).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.getByText(/Resposta do assistente/i)).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(screen.getByRole("button", { name: /Gerar site/i })).toBeInTheDocument();
  });

  it("gera site e mostra botões preview/download", async () => {
    const user = userEvent.setup();
    renderPage();
    const prompt = screen.getByRole("textbox", { name: /Prompt para descrever o site/i });
    await user.type(prompt, "Site vitrine para agência IA com features e FAQ");
    await user.click(screen.getByRole("button", { name: /Enviar mensagem/i }));

    await waitFor(() => screen.getByRole("button", { name: /Gerar site/i }));

    await user.click(screen.getByRole("button", { name: /Gerar site/i }));

    await waitFor(
      () => {
        expect(screen.getByText(/Site gerado com sucesso/i)).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(
      screen.getByRole("link", { name: /Abrir no separador/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Download/i })).toBeInTheDocument();
  });
});
