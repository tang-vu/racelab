export function extractClaimMethod(text) {
  if (typeof text !== "string" || text.length > 150000)
    throw new Error("Choose a source file smaller than 150KB.");
  const match = /(?:^|\n)[ \t]*claimNextDue\s*\(/.exec(text);
  if (!match)
    throw new Error(
      "No claimNextDue method was found. This workspace supports the declared job-claim contract.",
    );
  const start = match.index + (match[0].startsWith("\n") ? 1 : 0);
  let quote = "",
    escaped = false,
    line = false,
    block = false,
    depth = 0,
    opened = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i],
      next = text[i + 1];
    if (line) {
      if (c === "\n") line = false;
      continue;
    }
    if (block) {
      if (c === "*" && next === "/") {
        block = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === quote) quote = "";
      continue;
    }
    if (c === "/" && next === "/") {
      line = true;
      i++;
      continue;
    }
    if (c === "/" && next === "*") {
      block = true;
      i++;
      continue;
    }
    if (["'", '"', "`"].includes(c)) {
      quote = c;
      continue;
    }
    if (c === "{") {
      depth++;
      opened = true;
    }
    if (c === "}" && opened && --depth === 0) {
      const method = text.slice(start, i + 1).trim();
      if (method.length > 12000)
        throw new Error("The extracted method exceeds 12,000 characters.");
      return method;
    }
  }
  throw new Error(
    "Could not isolate a complete method. Paste only claimNextDue and check its braces.",
  );
}

export const blankMethod =
  "claimNextDue(now = new Date()) {\n  // Implement this method against the recovery contract below.\n  return null;\n}";
export const PROJECT_KEY = "racelab-method-projects-v1";
