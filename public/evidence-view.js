const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

export function highlightSource(source) {
  const tokens =
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:export|async|await|function|const|let|if|else|return|try|finally|throw|new|true|false|null)\b|\b\d+(?:\.\d+)?\b|\b\w+(?=\()/g;
  let result = "",
    previous = 0;
  for (const match of source.matchAll(tokens)) {
    result += escape(source.slice(previous, match.index));
    const token = match[0];
    const kind = /^["'`]/.test(token)
      ? "string"
      : /^\d/.test(token)
        ? "number"
        : /^\//.test(token)
          ? "comment"
          : /^(export|async|await|function|const|let|if|else|return|try|finally|throw|new|true|false|null)$/.test(
                token,
              )
            ? "keyword"
            : "method";
    result += `<span class="token-${kind}">${escape(token)}</span>`;
    previous = match.index + token.length;
  }
  return result + escape(source.slice(previous)) + "\n";
}

// A visible shared read is evidence, not a claim that it caused every failure.
export function collisionPair(run, caseId) {
  if (!run || run.status !== "completed" || run.verdict.passed) return null;
  const reads = new Map();
  for (const event of run.trace) {
    const relevant =
      caseId === "last-seat"
        ? event.key === "stock"
        : caseId === "lost-update"
          ? event.key === "count"
          : event.key.startsWith("seen:");
    if (!relevant) continue;
    if (event.method !== "get") {
      if (["set", "compareAndSwap", "insertOnce"].includes(event.method))
        reads.delete(event.key);
      continue;
    }
    const prior = reads.get(event.key);
    if (
      prior &&
      prior.actor !== event.actor &&
      JSON.stringify(prior.result) === JSON.stringify(event.result)
    )
      return {
        first: prior.step,
        second: event.step,
        key: event.key,
        value: event.result,
      };
    reads.set(event.key, event);
  }
  return null;
}

export function impactFor(fixture, snapshot) {
  const initial = fixture.scenario.initial;
  const requests = fixture.scenario.requests;
  if (fixture.id === "last-seat")
    return {
      actual: (snapshot.orders ?? []).reduce((n, row) => n + row.quantity, 0),
      expected: initial.stock,
      label: "COMMITTED / AVAILABLE SEATS",
    };
  if (fixture.id === "webhook")
    return {
      actual: snapshot.notifications?.length ?? 0,
      expected: new Set(requests.map((row) => row.id)).size,
      label: "SENT / DISTINCT EVENTS",
    };
  return {
    actual: snapshot.count,
    expected: initial.count + requests.reduce((n, row) => n + row.delta, 0),
    label: "CURRENT / EXPECTED COUNT",
  };
}
