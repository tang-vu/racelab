export const LIVE_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
export const LIVE_ALLOCATION = "racelab-public-scout-20261103";
export const LIVE_CAP_MICROS = 2_000_000;
export const LIVE_MAX_TURNS = 6;
export const LIVE_MAX_OUTPUT = 3072;
export const LIVE_RESERVATION_MICROS = Math.ceil(
  131_000 * 0.27 + LIVE_MAX_OUTPUT * 0.85,
);

type Reservation = { id: string; micros: number; at: number };
export type LiveBudgetState = {
  version: 1;
  allocation: string;
  cap: number;
  spent: number;
  held: number;
  blocked: string | null;
  active: { id: string; expires: number } | null;
  pending: Reservation[];
  rates: {
    client: string;
    hour: number;
    day: number;
    hourly: number;
    daily: number;
  }[];
};

export function newLiveBudget(): LiveBudgetState {
  return {
    version: 1,
    allocation: LIVE_ALLOCATION,
    cap: LIVE_CAP_MICROS,
    spent: 0,
    held: 0,
    blocked: null,
    active: null,
    pending: [],
    rates: [],
  };
}

export function checkBudget(state: LiveBudgetState) {
  if (
    state.version !== 1 ||
    state.allocation !== LIVE_ALLOCATION ||
    state.cap !== LIVE_CAP_MICROS ||
    !Number.isSafeInteger(state.spent) ||
    !Number.isSafeInteger(state.held) ||
    state.spent < 0 ||
    state.held < 0 ||
    !Array.isArray(state.pending) ||
    state.pending.some(
      (r) =>
        typeof r.id !== "string" ||
        !Number.isSafeInteger(r.micros) ||
        r.micros !== LIVE_RESERVATION_MICROS,
    ) ||
    state.pending.reduce((sum, r) => sum + r.micros, 0) !== state.held
  )
    throw new Error(
      "Live accounting cannot be verified. New AI repairs are paused.",
    );
}

export function availability(
  state: LiveBudgetState,
  client: string,
  now: number,
) {
  checkBudget(state);
  if (state.blocked) return { enabled: false, reason: state.blocked };
  if (state.spent + state.held + LIVE_RESERVATION_MICROS > state.cap)
    return {
      enabled: false,
      reason:
        "The sponsored AI preview has reached its budget. Recorded rechecks still work.",
    };
  const day = Math.floor(now / 86_400_000),
    hour = Math.floor(now / 3_600_000);
  const rate = state.rates.find((r) => r.client === client && r.day === day);
  if (rate && (rate.daily >= 12 || (rate.hour === hour && rate.hourly >= 6)))
    return {
      enabled: false,
      reason:
        "Your live repair preview limit has been reached. Try again later; execution and recorded rechecks still work.",
    };
  if (state.active && state.active.expires > now)
    return {
      enabled: false,
      reason: "Another live repair is running. Try again shortly.",
    };
  return { enabled: true, reason: "Ready for a new Meta repair." };
}

export function beginLiveJob(
  state: LiveBudgetState,
  client: string,
  id: string,
  now: number,
) {
  checkBudget(state);
  if (state.active && state.active.expires <= now) {
    for (const pending of state.pending) state.spent += pending.micros;
    if (state.pending.length)
      state.blocked =
        "A model request was interrupted. Live repair is paused for cost review.";
    state.pending = [];
    state.held = 0;
    state.active = null;
  }
  const ready = availability(state, client, now);
  if (!ready.enabled) throw new Error(ready.reason);
  const day = Math.floor(now / 86_400_000),
    hour = Math.floor(now / 3_600_000);
  state.rates = state.rates.filter((r) => r.day === day);
  let rate = state.rates.find((r) => r.client === client);
  if (!rate) {
    rate = { client, day, hour, hourly: 0, daily: 0 };
    state.rates.push(rate);
  }
  if (rate.hour !== hour) {
    rate.hour = hour;
    rate.hourly = 0;
  }
  rate.hourly++;
  rate.daily++;
  state.active = { id, expires: now + 10 * 60_000 };
}

export function reserveLiveCall(
  state: LiveBudgetState,
  id: string,
  now: number,
  jobId: string,
) {
  checkBudget(state);
  if (
    !state.active ||
    state.active.id !== jobId ||
    state.active.expires <= now ||
    state.blocked
  )
    throw new Error("The live repair session is no longer active.");
  if (state.spent + state.held + LIVE_RESERVATION_MICROS > state.cap)
    throw new Error(
      "The live AI budget would be exceeded. No model request was sent.",
    );
  if (state.pending.some((r) => r.id === id))
    throw new Error("Duplicate model reservation.");
  state.pending.push({ id, micros: LIVE_RESERVATION_MICROS, at: now });
  state.held += LIVE_RESERVATION_MICROS;
}

export function settleLiveCall(
  state: LiveBudgetState,
  id: string,
  usage: unknown,
) {
  checkBudget(state);
  const entry = state.pending.find((r) => r.id === id);
  if (!entry) throw new Error("Unknown model reservation.");
  const u = usage as {
    prompt_tokens?: number;
    completion_tokens?: number;
  } | null;
  const known =
    Number.isSafeInteger(u?.prompt_tokens) &&
    (u?.prompt_tokens ?? -1) >= 0 &&
    Number.isSafeInteger(u?.completion_tokens) &&
    (u?.completion_tokens ?? -1) >= 0;
  const cost = known
    ? Math.ceil(u!.prompt_tokens! * 0.27 + u!.completion_tokens! * 0.85)
    : entry.micros;
  state.spent += cost;
  state.held -= entry.micros;
  state.pending = state.pending.filter((r) => r.id !== id);
  if (!known || cost > entry.micros)
    state.blocked =
      "A model charge needs review. Live AI is paused; recorded rechecks still work.";
  return { costMicros: cost, known };
}
