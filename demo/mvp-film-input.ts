class WorkerClaims {
claimNextDue(now = new Date()) {
  const at = now.toISOString();
  const expired = new Date(now.getTime() - 30000).toISOString();
  return this.database.transaction(() => {
    const selected = this.database.prepare(
      "SELECT * FROM follow_ups WHERE due_at <= ? AND (status IN ('scheduled', 'retrying') OR (status = 'claimed' AND claimed_at IS NOT NULL AND claimed_at <= ?)) ORDER BY due_at ASC LIMIT 1"
    ).get(at, expired);
    if (!selected) return null;
    this.database.prepare("UPDATE follow_ups SET status = 'claimed', claimed_at = ?, attempt_count = attempt_count + 1 WHERE id = ?").run(at, selected.id);
    return followUpFromRow(this.database.prepare("SELECT * FROM follow_ups WHERE id = ?").get(selected.id));
  })();
}
}
