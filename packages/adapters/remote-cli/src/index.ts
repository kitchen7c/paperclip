export const type = "remote_cli";
export const label = "Remote CLI (SSH)";
export const DEFAULT_REMOTE_CLI_MODEL = "auto";

export const models = [
  { id: DEFAULT_REMOTE_CLI_MODEL, label: "Auto" }
];

export const agentConfigurationDoc = `# remote_cli agent configuration

Adapter: remote_cli

Use when:
- You want Paperclip to run an AI CLI agent (Gemini, Codex, etc.) on a remote server via SSH.
- You need deep integration (syncing code workspaces, injecting skills, handling long sessions) just like local execution.

Core fields:
- sshHost (string, required): The hostname or IP address of the remote server.
- sshPort (number, optional): SSH port. Defaults to 22.
- sshUser (string, required): The SSH username.
- sshPrivateKey (string, optional): SSH private key content (can use secrets like \`{{secrets.SSH_KEY}}\`).
- cliType (string, required): Which CLI to drive. Supported: 'gemini', 'codex', 'claude'.
- remoteCliPath (string, required): Absolute path to the CLI executable on the remote server (e.g. \`/usr/local/bin/gemini\`).
- remoteWorkspaceCwd (string, required): Absolute path on the remote server where the code will be synchronized.

- model (string, optional): The model ID. Defaults to auto.
- command (string, optional): Additional prefix if needed.
- env (object, optional): KEY=VALUE environment variables to set remotely.

Operational fields:
- timeoutSec (number, optional): run timeout in seconds.
- graceSec (number, optional): SIGTERM grace period in seconds.
`;
