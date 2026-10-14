import {
  TmuxAgentOpenRequestSchemaZ,
  TmuxAgentOpenResponseSchemaZ,
  type TmuxAgentOpenRequest,
  type TmuxAgentOpenResponse,
} from "../../../packages/contracts/src/tmux-agent-open.ts";
import { RESERVED_DISCOVERED_TERMINAL_ID_PREFIX } from "../../../packages/contracts/src/semantic-identity.ts";
import type { HomeAgentRow } from "../../../packages/presentation/src/home-agent-roster.ts";
import { agentAvailable } from "./home-agent-publication.ts";

/** Admission is offered only behind a current, private fleet route. */
export function discoveredAgentRequest(row: HomeAgentRow | undefined) {
  if (
    !row ||
    row.disabled ||
    row.nativeIdentity ||
    row.interactionEndpoint ||
    !row.paneId?.startsWith(RESERVED_DISCOVERED_TERMINAL_ID_PREFIX)
  )
    return null;
  const parsed = TmuxAgentOpenRequestSchemaZ.safeParse({
    observedPaneId: row.paneId,
    observedAgentId: row.agentId,
  });
  return parsed.success ? parsed.data : null;
}

/** The daemon alone maps the observed identity across promotion. Never derive that mapping. */
export async function admitFleetAgent(
  expected: HomeAgentRow,
  open: (request: TmuxAgentOpenRequest) => Promise<unknown>,
  readRows: (admission: TmuxAgentOpenResponse) => Promise<readonly HomeAgentRow[]>,
  verifyRoute: () => Promise<unknown>,
  current: () => boolean,
): Promise<TmuxAgentOpenResponse> {
  const request = discoveredAgentRequest(expected);
  const check = () => {
    if (!current()) throw new Error("Fleet agent selection changed");
  };
  check();
  if (!request || !expected.server) throw new Error("Agent admission unavailable");
  const captured = structuredClone(expected);
  const admission = TmuxAgentOpenResponseSchemaZ.parse(await open(request));
  check();
  if (
    admission.liveSessionId !== captured.liveSessionId ||
    admission.server.serverId !== captured.server!.serverId ||
    admission.server.generation !== captured.server!.generation
  )
    throw new Error("Agent admission scope changed");
  const rows = await readRows(admission);
  check();
  const matches = rows.filter((row) => row.paneId === admission.semanticPaneId);
  if (
    matches.length !== 1 ||
    !agentAvailable(matches[0]) ||
    matches[0].liveSessionId !== admission.liveSessionId ||
    matches[0].server?.serverId !== admission.server.serverId ||
    matches[0].server?.generation !== admission.server.generation
  )
    throw new Error("Admitted agent is no longer available");
  await verifyRoute();
  check();
  return admission;
}
