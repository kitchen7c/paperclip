import type { UIAdapterModule } from "../types";
import { parseRemoteCliStdoutLine, buildRemoteCliConfig } from "@paperclipai/adapter-remote-cli/ui";

export const remoteCliUIAdapter: UIAdapterModule = {
  type: "remote_cli",
  label: "Remote CLI (SSH)",
  parseStdoutLine: parseRemoteCliStdoutLine,
  ConfigFields: () => null, // Provide a generic JSON config field or custom later
  buildAdapterConfig: buildRemoteCliConfig,
};
