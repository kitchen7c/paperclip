import type { UIAdapterModule } from "../types";
import { parseRemoteCliStdoutLine, buildRemoteCliConfig } from "@paperclipai/adapter-remote-cli/ui";
import { RemoteCliConfigFields } from "./config-fields";

export const remoteCliUIAdapter: UIAdapterModule = {
  type: "remote_cli",
  label: "Remote CLI (SSH)",
  parseStdoutLine: parseRemoteCliStdoutLine,
  ConfigFields: RemoteCliConfigFields,
  buildAdapterConfig: buildRemoteCliConfig,
};
