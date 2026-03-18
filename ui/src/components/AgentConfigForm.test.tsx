// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "@paperclipai/shared";
import { AgentConfigForm } from "./AgentConfigForm";

const {
  agentsListMock,
  adapterModelsMock,
  testEnvironmentMock,
  secretsListMock,
  uploadImageMock,
} = vi.hoisted(() => ({
  agentsListMock: vi.fn(),
  adapterModelsMock: vi.fn(),
  testEnvironmentMock: vi.fn(),
  secretsListMock: vi.fn(),
  uploadImageMock: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (value: string) => value }),
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompanyId: "company-1" }),
}));

vi.mock("../adapters", () => ({
  getUIAdapter: () => ({
    ConfigFields: () => null,
    buildAdapterConfig: () => ({}),
  }),
}));

vi.mock("../api/agents", () => ({
  agentsApi: {
    list: agentsListMock,
    adapterModels: adapterModelsMock,
    testEnvironment: testEnvironmentMock,
  },
}));

vi.mock("../api/secrets", () => ({
  secretsApi: {
    list: secretsListMock,
  },
}));

vi.mock("../api/assets", () => ({
  assetsApi: {
    uploadImage: uploadImageMock,
  },
}));

vi.mock("./MarkdownEditor", () => ({
  MarkdownEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange?: (value: string) => void;
  }) => (
    <textarea
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => children,
  TooltipContent: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => children,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => children,
  PopoverContent: ({ children }: { children: React.ReactNode }) => children,
}));

function createAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    companyId: "company-1",
    name: "Engineer",
    urlKey: "engineer",
    role: "engineer",
    title: "Engineer",
    icon: null,
    status: "active",
    reportsTo: null,
    capabilities: null,
    adapterType: "http",
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 0,
    spentMonthlyCents: 0,
    pauseReason: null,
    pausedAt: null,
    permissions: { canCreateAgents: false },
    lastHeartbeatAt: null,
    metadata: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function waitForSelector(container: HTMLElement, selector: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const match = container.querySelector(selector);
    if (match) return match;
    await flush();
  }
  return null;
}

describe("AgentConfigForm", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    agentsListMock.mockResolvedValue([
      createAgent({ id: "manager-1", name: "CTO", urlKey: "cto", role: "cto" }),
      createAgent(),
    ]);
    adapterModelsMock.mockResolvedValue([]);
    secretsListMock.mockResolvedValue([]);
    testEnvironmentMock.mockResolvedValue({
      adapterType: "http",
      status: "pass",
      checks: [],
      testedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
    });
    uploadImageMock.mockResolvedValue({ contentPath: "/assets/test.png" });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  it("lets edit mode assign a manager and saves reportsTo", async () => {
    const onSave = vi.fn();
    let saveAction: (() => void) | null = null;

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AgentConfigForm
            mode="edit"
            agent={createAgent()}
            onSave={onSave}
            onSaveActionChange={(nextAction) => {
              saveAction = nextAction;
            }}
          />
        </QueryClientProvider>,
      );
    });

    await flush();

    const reportsToSelect = container.querySelector(
      'select[name="reportsTo"]',
    ) as HTMLSelectElement | null;

    expect(reportsToSelect).not.toBeNull();
    expect(await waitForSelector(container, 'option[value="manager-1"]')).not.toBeNull();

    await act(async () => {
      reportsToSelect!.value = "manager-1";
      reportsToSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await flush();

    expect(saveAction).not.toBeNull();

    await act(async () => {
      saveAction?.();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ reportsTo: "manager-1" }),
    );
  });
});
