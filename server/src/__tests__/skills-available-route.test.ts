import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accessRoutes } from "../routes/access.js";
import { errorHandler } from "../middleware/index.js";

const mockAccessService = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  canUser: vi.fn(),
  isInstanceAdmin: vi.fn(),
  getMembership: vi.fn(),
  ensureMembership: vi.fn(),
  listMembers: vi.fn(),
  setMemberPermissions: vi.fn(),
  promoteInstanceAdmin: vi.fn(),
  demoteInstanceAdmin: vi.fn(),
  listUserCompanyAccess: vi.fn(),
  setUserCompanyAccess: vi.fn(),
  setPrincipalGrants: vi.fn(),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

vi.mock("../services/index.js", () => ({
  accessService: () => mockAccessService,
  agentService: () => mockAgentService,
  deduplicateAgentName: vi.fn(),
  logActivity: vi.fn(),
  notifyHireApproved: vi.fn(),
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      source: "session",
      userId: "user-1",
      companyIds: ["company-1"],
      isInstanceAdmin: false,
    };
    next();
  });
  app.use(
    "/api",
    accessRoutes({} as any, {
      deploymentMode: "local_trusted",
      deploymentExposure: "private",
      bindHost: "127.0.0.1",
      allowedHostnames: [],
    }),
  );
  app.use(errorHandler);
  return app;
}

async function writeSkill(homeDir: string, relativeDir: string, skillName: string, description: string) {
  const skillDir = path.join(homeDir, relativeDir, skillName);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(
    path.join(skillDir, "SKILL.md"),
    `---\ndescription: ${description}\n---\n\n# ${skillName}\n`,
    "utf8",
  );
}

describe("GET /skills/available", () => {
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;
  let originalCodexHome: string | undefined;
  let tempHome: string;

  beforeEach(async () => {
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    originalCodexHome = process.env.CODEX_HOME;
    tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-skills-available-"));
    process.env.HOME = tempHome;
    process.env.USERPROFILE = tempHome;
    delete process.env.CODEX_HOME;
  });

  afterEach(async () => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;

    if (originalUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = originalUserProfile;

    if (originalCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = originalCodexHome;

    await fs.rm(tempHome, { recursive: true, force: true });
  });

  it("uses the adapter-specific local skills directory", async () => {
    await writeSkill(tempHome, ".claude/skills", "claude-skill", "Claude skill");
    await writeSkill(tempHome, ".cursor/skills", "cursor-skill", "Cursor skill");
    await writeSkill(tempHome, ".gemini/skills", "gemini-skill", "Gemini skill");
    await writeSkill(tempHome, ".pi/agent/skills", "pi-skill", "Pi skill");

    const codexHome = path.join(tempHome, "custom-codex-home");
    process.env.CODEX_HOME = codexHome;
    await writeSkill(codexHome, "skills", "codex-skill", "Codex skill");

    const app = createApp();

    const claudeRes = await request(app).get("/api/skills/available").query({ adapterType: "claude_local" });
    const cursorRes = await request(app).get("/api/skills/available").query({ adapterType: "cursor" });
    const geminiRes = await request(app).get("/api/skills/available").query({ adapterType: "gemini_local" });
    const piRes = await request(app).get("/api/skills/available").query({ adapterType: "pi_local" });
    const codexRes = await request(app).get("/api/skills/available").query({ adapterType: "codex_local" });

    expect(claudeRes.status).toBe(200);
    expect(claudeRes.body.skills.map((skill: { name: string }) => skill.name)).toEqual(["claude-skill"]);
    expect(cursorRes.body.skills.map((skill: { name: string }) => skill.name)).toEqual(["cursor-skill"]);
    expect(geminiRes.body.skills.map((skill: { name: string }) => skill.name)).toEqual(["gemini-skill"]);
    expect(piRes.body.skills.map((skill: { name: string }) => skill.name)).toEqual(["pi-skill"]);
    expect(codexRes.body.skills.map((skill: { name: string }) => skill.name)).toEqual(["codex-skill"]);
  });
});
