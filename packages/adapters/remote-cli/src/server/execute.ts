import { Client } from "ssh2";
import { runChildProcess, parseObject, buildPaperclipEnv } from "@paperclipai/adapter-utils/server-utils";
import type { 
  AdapterExecutionResult, 
  AdapterExecutionContext, 
  AdapterEnvironmentTestContext, 
  AdapterEnvironmentTestResult 
} from "@paperclipai/adapter-utils";

function asString(val: unknown, fallback = ""): string {
  return typeof val === "string" ? val : fallback;
}

function buildRsyncCommand(
  direction: "up" | "down",
  localCwd: string,
  remoteHost: string,
  remoteUser: string,
  remotePort: number,
  remoteCwd: string,
  privateKeyPath?: string
): { command: string; args: string[] } {
  // Use a trailing slash on source to sync contents, not the directory itself
  const localSrc = localCwd.endsWith("/") ? localCwd : `${localCwd}/`;
  const remoteSrc = remoteCwd.endsWith("/") ? remoteCwd : `${remoteCwd}/`;
  const sshCmd = privateKeyPath 
    ? `ssh -p ${remotePort} -i ${privateKeyPath} -o StrictHostKeyChecking=no` 
    : `ssh -p ${remotePort} -o StrictHostKeyChecking=no`;

  const args = [
    "-avz", 
    "--delete", 
    "--exclude=.git", 
    "--exclude=node_modules", 
    "-e", sshCmd
  ];

  if (direction === "up") {
    args.push(localSrc, `${remoteUser}@${remoteHost}:${remoteCwd}`);
  } else {
    args.push(`${remoteUser}@${remoteHost}:${remoteSrc}`, localCwd);
  }

  return { command: "rsync", args };
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, authToken, onLog, config, context, runtime } = ctx;

  const sshHost = asString(config.sshHost, "127.0.0.1");
  const sshPort = typeof config.sshPort === "number" ? config.sshPort : 22;
  const sshUser = asString(config.sshUser, "root");
  const sshPrivateKey = asString(config.sshPrivateKey, "");
  const cliType = asString(config.cliType, "gemini");
  const remoteCliPath = asString(config.remoteCliPath, "gemini");
  const remoteWorkspaceCwd = asString(config.remoteWorkspaceCwd, "/tmp/paperclip-remote-workspace");
  const model = asString(config.model, "auto");

  const workspaceContext = parseObject(context.paperclipWorkspace);
  const localWorkspaceCwd = asString(workspaceContext.cwd, process.cwd());

  // Build the environment dictionary to send over SSH
  const envConfig = parseObject(config.env);
  const env: Record<string, string> = { ...buildPaperclipEnv(agent) };
  env.PAPERCLIP_RUN_ID = runId;
  const wakeTaskId = asString(context.taskId, asString(context.issueId, ""));
  if (wakeTaskId) env.PAPERCLIP_TASK_ID = wakeTaskId;
  const wakeReason = asString(context.wakeReason, "");
  if (wakeReason) env.PAPERCLIP_WAKE_REASON = wakeReason;
  env.PAPERCLIP_WORKSPACE_CWD = remoteWorkspaceCwd;
  
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") env[key] = value;
  }
  if (authToken && typeof env.PAPERCLIP_API_KEY !== "string") {
    env.PAPERCLIP_API_KEY = authToken;
  }

  // E.g. prompt is the next user input
  const prompt = asString(context.paperclipRunPrompt, "Respond with hello");

  // Step 1: Sync up
  await onLog("stderr", `[remote-cli] Syncing local workspace to ${sshHost}...\\n`);

  // Create a temporary private key file if provided
  let keyPath: string | undefined;
  if (sshPrivateKey) {
    const fs = await import("fs/promises");
    const os = await import("os");
    const path = await import("path");
    keyPath = path.join(os.tmpdir(), `paperclip-ssh-${runId}.key`);
    await fs.writeFile(keyPath, sshPrivateKey, { mode: 0o600 });
  }

  try {
    const syncUp = buildRsyncCommand("up", localWorkspaceCwd, sshHost, sshUser, sshPort, remoteWorkspaceCwd, keyPath);
    await runChildProcess(runId, syncUp.command, syncUp.args, {
      cwd: localWorkspaceCwd,
      env: process.env as Record<string, string>,
      timeoutSec: 60,
      graceSec: 10,
      onLog: async (stream, chunk) => await onLog("stderr", `[rsync-up] ${chunk}`),
    });
  } catch (err: any) {
    await onLog("stderr", `[remote-cli] Failed to sync up: ${err.message}\\n`);
    if (keyPath) await import("fs/promises").then(fs => fs.unlink(keyPath!).catch(() => {}));
    return { exitCode: 1, signal: null, timedOut: false, errorMessage: err.message };
  }

  await onLog("stderr", `[remote-cli] Connecting to ${sshUser}@${sshHost}:${sshPort}...\\n`);

  const execPromise = new Promise<AdapterExecutionResult>((resolve) => {
    const conn = new Client();

    let stdoutBuffer = "";
    let stderrBuffer = "";

    conn.on("ready", () => {
      onLog("stderr", `[remote-cli] SSH Connected. Executing ${cliType}...\\n`);

      // Basic command generation
      let command = `mkdir -p ${remoteWorkspaceCwd} && cd ${remoteWorkspaceCwd} && ${remoteCliPath} --output-format json`;

      // Inject session resumption (Phase 3 logic)
      let sessionId = null;
      if (typeof runtime.sessionParams === "object" && runtime.sessionParams !== null) {
        const sp = runtime.sessionParams as Record<string, unknown>;
        sessionId = asString(sp.sessionId, "");
        if (sessionId) {
          if (cliType === "gemini") {
            command += ` --resume "${sessionId}"`;
          } else if (cliType === "codex") {
             // Codex resumption pattern
             command = `mkdir -p ${remoteWorkspaceCwd} && cd ${remoteWorkspaceCwd} && ${remoteCliPath} resume "${sessionId}" -`;
          }
        }
      }

      // Add prompt
      if (cliType === "gemini") {
         // Prevent injection by writing prompt to stdin instead of argument, using cat - if supported
         // Or write to a temp file and source it.
         // For gemini CLI, it currently only takes prompt as positional.
         // As a hotfix, base64 encode the prompt and decode it on the remote.
         command += ` "$(echo '${Buffer.from(prompt).toString("base64")}' | base64 -d)"`;
      }

      conn.exec(command, { env }, (err, stream) => {
        if (err) {
          conn.end();
          resolve({ exitCode: 1, signal: null, timedOut: false, errorMessage: err.message });
          return;
        }

        // For Codex, send the prompt over stdin.
        if (cliType === "codex") {
           stream.write(prompt);
           stream.end();
        }

        stream.on("close", (code: number, signal: string) => {
          conn.end();
          onLog("stderr", `[remote-cli] Process closed with code ${code} signal ${signal}\\n`);

          let parsedJson = null;
          const lines = stdoutBuffer.split("\\n");
          for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].trim()) {
              try {
                parsedJson = JSON.parse(lines[i]);
                break;
              } catch {}
            }
          }

          let newSessionId = sessionId;
          if (parsedJson && parsedJson.session_id) {
             newSessionId = parsedJson.session_id;
          } else if (parsedJson && parsedJson.sessionId) {
             newSessionId = parsedJson.sessionId;
          }

          resolve({
            exitCode: code,
            signal: signal || null,
            timedOut: false,
            errorMessage: code !== 0 ? `Exited with code ${code}` : null,
            sessionId: newSessionId,
            sessionParams: newSessionId ? { sessionId: newSessionId, cwd: remoteWorkspaceCwd } : null,
            sessionDisplayId: newSessionId,
            resultJson: parsedJson,
          });
        }).on("data", (data: any) => {
          const text = data.toString();
          stdoutBuffer += text;
          onLog("stdout", text).catch(() => {});
        }).stderr.on("data", (data: any) => {
          const text = data.toString();
          stderrBuffer += text;
          onLog("stderr", text).catch(() => {});
        });
      });
    }).on("error", (err: Error) => {
      onLog("stderr", `[remote-cli] SSH Error: ${err.message}\\n`);
      resolve({ exitCode: 1, signal: null, timedOut: false, errorMessage: err.message });
    });

    try {
      conn.connect({
        host: sshHost,
        port: sshPort,
        username: sshUser,
        privateKey: sshPrivateKey || undefined,
      });
    } catch (err: any) {
      resolve({ exitCode: 1, signal: null, timedOut: false, errorMessage: err.message });
    }
  });

  const execResult = await execPromise;

  // Step 3: Sync Down
  if (execResult.exitCode === 0) {
     await onLog("stderr", `[remote-cli] Syncing workspace changes back from ${sshHost}...\\n`);
     try {
       const syncDown = buildRsyncCommand("down", localWorkspaceCwd, sshHost, sshUser, sshPort, remoteWorkspaceCwd, keyPath);
       await runChildProcess(runId, syncDown.command, syncDown.args, {
         cwd: localWorkspaceCwd,
         env: process.env as Record<string, string>,
         timeoutSec: 60,
         graceSec: 10,
         onLog: async (stream, chunk) => await onLog("stderr", `[rsync-down] ${chunk}`),
       });
     } catch (err: any) {
       await onLog("stderr", `[remote-cli] Failed to sync down: ${err.message}\\n`);
     }
  }

  if (keyPath) {
     await import("fs/promises").then(fs => fs.unlink(keyPath!).catch(() => {}));
  }

  return execResult;
}

export async function testEnvironment(ctx: AdapterEnvironmentTestContext): Promise<AdapterEnvironmentTestResult> {
  const sshHost = asString(ctx.config.sshHost, "127.0.0.1");
  return {
    adapterType: "remote_cli",
    status: "pass",
    checks: [
      {
        code: "ssh_config_present",
        level: "info",
        message: `SSH Host configured as ${sshHost}`,
      }
    ],
    testedAt: new Date().toISOString()
  };
}