import type { AdapterConfigFieldsProps } from "../types";
import { DraftInput, Field } from "../../components/agent-config-primitives";
import { useTranslation } from "react-i18next";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

export function RemoteCliConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  const { t } = useTranslation();
  
  // Create mode uses custom state object `remoteCliState`, Edit mode uses direct config fields
  const sshHost = isCreate ? (values as any).remoteCliState?.sshHost ?? "" : eff("adapterConfig", "sshHost", String(config.sshHost ?? ""));
  const sshPort = isCreate ? (values as any).remoteCliState?.sshPort ?? "22" : eff("adapterConfig", "sshPort", String(config.sshPort ?? "22"));
  const sshUser = isCreate ? (values as any).remoteCliState?.sshUser ?? "" : eff("adapterConfig", "sshUser", String(config.sshUser ?? ""));
  const sshPrivateKey = isCreate ? (values as any).remoteCliState?.sshPrivateKey ?? "" : eff("adapterConfig", "sshPrivateKey", String(config.sshPrivateKey ?? ""));
  const cliType = isCreate ? (values as any).remoteCliState?.cliType ?? "gemini" : eff("adapterConfig", "cliType", String(config.cliType ?? "gemini"));
  const remoteCliPath = isCreate ? (values as any).remoteCliState?.remoteCliPath ?? "" : eff("adapterConfig", "remoteCliPath", String(config.remoteCliPath ?? ""));
  const remoteWorkspaceCwd = isCreate ? (values as any).remoteCliState?.remoteWorkspaceCwd ?? "" : eff("adapterConfig", "remoteWorkspaceCwd", String(config.remoteWorkspaceCwd ?? ""));

  const update = (key: string, v: unknown) => {
    if (isCreate) {
       const state = (values as any).remoteCliState || {};
       set!({ remoteCliState: { ...state, [key]: v } } as any);
    } else {
       mark("adapterConfig", key, v || undefined);
    }
  };

  return (
    <>
      <Field label={t("SSH Host/IP")} hint={t("The IP address or domain name of the remote server.")}>
        <DraftInput
          value={sshHost}
          onCommit={(v) => update("sshHost", v)}
          immediate
          className={inputClass}
          placeholder="192.168.1.100"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("SSH User")} hint={t("Username for the SSH connection.")}>
          <DraftInput
            value={sshUser}
            onCommit={(v) => update("sshUser", v)}
            immediate
            className={inputClass}
            placeholder="ubuntu"
          />
        </Field>
        <Field label={t("SSH Port")} hint={t("Port number for SSH.")}>
          <DraftInput
            value={sshPort}
            onCommit={(v) => update("sshPort", Number(v))}
            immediate
            className={inputClass}
            placeholder="22"
          />
        </Field>
      </div>

      <Field label={t("SSH Private Key")} hint={t("Use {{secrets.KEY_NAME}} to securely load from Paperclip Secrets.")}>
        <DraftInput
          value={sshPrivateKey}
          onCommit={(v) => update("sshPrivateKey", v)}
          immediate
          className={inputClass}
          placeholder="{{secrets.MY_SSH_KEY}}"
        />
      </Field>

      <Field label={t("CLI Type")} hint={t("Which CLI agent is installed remotely? (gemini or codex)")}>
        <select
          value={cliType}
          onChange={(e) => update("cliType", e.target.value)}
          className={inputClass}
        >
          <option value="gemini">Gemini CLI</option>
          <option value="codex">Codex CLI</option>
        </select>
      </Field>

      <Field label={t("Remote CLI Path")} hint={t("Absolute path to the CLI executable on the remote machine.")}>
        <DraftInput
          value={remoteCliPath}
          onCommit={(v) => update("remoteCliPath", v)}
          immediate
          className={inputClass}
          placeholder="/usr/local/bin/gemini"
        />
      </Field>

      <Field label={t("Remote Workspace CWD")} hint={t("Temporary directory on the remote server where code will be synced.")}>
        <DraftInput
          value={remoteWorkspaceCwd}
          onCommit={(v) => update("remoteWorkspaceCwd", v)}
          immediate
          className={inputClass}
          placeholder="/home/ubuntu/paperclip-remote-workspace"
        />
      </Field>
    </>
  );
}