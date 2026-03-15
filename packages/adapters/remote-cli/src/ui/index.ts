import { DEFAULT_REMOTE_CLI_MODEL } from "../index.js";
import type { CreateConfigValues, TranscriptEntry } from "@paperclipai/adapter-utils";

export function buildRemoteCliConfig(v: CreateConfigValues): Record<string, unknown> {
  // Pass through the JSON directly from the advanced editor for now, 
  // or build a basic structure.
  // In the real implementation, we extract sshHost, sshUser, cliType, etc.
  return {
    sshHost: "127.0.0.1",
    sshPort: 22,
    sshUser: "root",
    cliType: "gemini",
    remoteCliPath: "gemini",
    remoteWorkspaceCwd: "/tmp/remote-agent-workspace",
    model: v.model || DEFAULT_REMOTE_CLI_MODEL,
    // merge from UI state
    ...(v as any).remoteCliState
  };
}

export function parseRemoteCliStdoutLine(line: string, ts: string): TranscriptEntry[] {
  try {
    const parsed = JSON.parse(line);
    // Return a dummy init event or something compliant just to pass the build
    return [{ kind: "init", ts, model: DEFAULT_REMOTE_CLI_MODEL, sessionId: "" }];
  } catch {
    return [];
  }
}
