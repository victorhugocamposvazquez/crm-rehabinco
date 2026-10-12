export type AvmDataDispatchPayload = {
  layer: string;
  scope: string;
};

/** Dispara el workflow avm-data.yml (repository_dispatch). */
export async function dispatchAvmDataWorkflow(payload: AvmDataDispatchPayload): Promise<void> {
  const token = process.env.GITHUB_AVM_DATA_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY ?? "victorhugocamposvazquez/crm-rehabinco";
  if (!token) {
    console.warn("[avm-data] GITHUB_AVM_DATA_TOKEN no configurado; no se lanza GitHub Actions.");
    return;
  }

  const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      event_type: "avm-data-load",
      client_payload: payload,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub dispatch falló (${res.status}): ${text.slice(0, 400)}`);
  }
}
