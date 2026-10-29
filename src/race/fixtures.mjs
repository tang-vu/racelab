// Authored examples, created during the event. No answer patch is bundled here.
export const fixtures = [
  {
    id: "last-seat",
    title: "The last seat",
    category: "Inventory reservation",
    description: "One seat left. Two buyers. Both receive a confirmation.",
    invariant:
      "Confirmed quantities plus remaining stock must equal initial stock. Fill all available seats, once per request.",
    source: `export async function handle(db, request) {
  const available = await db.get("stock");
  if (available < request.quantity) {
    return { accepted: false };
  }
  await db.set("stock", available - request.quantity);
  await db.append("orders", {
    requestId: request.id,
    quantity: request.quantity
  });
  return { accepted: true };
}`,
    scenario: {
      initial: { stock: 1, orders: [], catalogVersion: 7 },
      requests: [
        { id: "buyer-ada", quantity: 1 },
        { id: "buyer-ben", quantity: 1 },
      ],
    },
    additional: [
      {
        initial: { stock: 0, orders: [], catalogVersion: 7 },
        requests: [{ id: "closed", quantity: 1 }],
      },
      {
        initial: { stock: 2, orders: [], catalogVersion: 7 },
        requests: [
          { id: "one", quantity: 1 },
          { id: "two", quantity: 1 },
        ],
      },
      {
        initial: { stock: 2, orders: [], catalogVersion: 7 },
        requests: [
          { id: "one", quantity: 1 },
          { id: "two", quantity: 1 },
          { id: "three", quantity: 1 },
        ],
      },
    ],
  },
  {
    id: "webhook",
    title: "Sent. Twice.",
    category: "Webhook deduplication",
    description:
      "The same event arrives twice. Each worker thinks it is the first.",
    invariant:
      "Exactly one notification per distinct event ID, with its original recipient and body. Preserve unrelated records.",
    source: `export async function handle(db, request) {
  const key = "seen:" + request.id;
  if (await db.get(key)) {
    return { sent: false };
  }
  await db.append("notifications", {
    eventId: request.id,
    to: request.to,
    body: request.body
  });
  await db.set(key, true);
  return { sent: true };
}`,
    scenario: {
      initial: { notifications: [], "seen:older": true, auditVersion: 4 },
      requests: [
        {
          id: "delivery-42",
          to: "ada@example.test",
          body: "Your parcel is ready.",
        },
        {
          id: "delivery-42",
          to: "ada@example.test",
          body: "Your parcel is ready.",
        },
      ],
    },
    additional: [
      {
        initial: { notifications: [], "seen:older": true, auditVersion: 4 },
        requests: [{ id: "fresh", to: "b@example.test", body: "Ready B" }],
      },
      {
        initial: { notifications: [], "seen:older": true, auditVersion: 4 },
        requests: [
          { id: "first", to: "a@example.test", body: "A" },
          { id: "second", to: "b@example.test", body: "B" },
        ],
      },
      {
        initial: { notifications: [], "seen:older": true, auditVersion: 4 },
        requests: Array.from({ length: 3 }, () => ({
          id: "retry",
          to: "c@example.test",
          body: "C",
        })),
      },
    ],
  },
  {
    id: "lost-update",
    title: "The missing update",
    category: "Shared counter",
    description:
      "Two jobs finish successfully. One of their updates disappears.",
    invariant:
      "The final count must equal initial count plus every requested delta, with exactly one matching receipt per request.",
    source: `export async function handle(db, request) {
  const before = await db.get("count");
  await db.set("count", before + request.delta);
  await db.append("applied", {
    requestId: request.id,
    delta: request.delta
  });
  return { applied: true };
}`,
    scenario: {
      initial: { count: 10, applied: [], auditVersion: 4 },
      requests: [
        { id: "job-ada", delta: 3 },
        { id: "job-ben", delta: 5 },
      ],
    },
    additional: [
      {
        initial: { count: 0, applied: [], auditVersion: 4 },
        requests: [{ id: "negative", delta: -2 }],
      },
      {
        initial: { count: 30, applied: [], auditVersion: 4 },
        requests: [
          { id: "a", delta: -4 },
          { id: "b", delta: 9 },
        ],
      },
      {
        initial: { count: 5, applied: [], auditVersion: 4 },
        requests: [
          { id: "a", delta: 2 },
          { id: "b", delta: -1 },
          { id: "c", delta: 7 },
        ],
      },
    ],
  },
];

export function fixtureFor(id) {
  const fixture = fixtures.find((item) => item.id === id);
  if (!fixture) throw new Error("Choose one of the supported contracts.");
  return structuredClone(fixture);
}

export function validateSource(source) {
  if (typeof source !== "string" || !source.trim() || source.length > 12000)
    throw new Error(
      "Provide an ES module of 1–12000 characters exporting handle(db, request).",
    );
  return source;
}
