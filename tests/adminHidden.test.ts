import { describe, expect, it } from "vitest";
import { stillHidden } from "@/components/admin/ForumModeration";
import type { AuditEntry } from "@/lib/api/admin";

const entry = (id: number, action: string, entity: string, entityId: string): AuditEntry => ({
  id,
  admin: null,
  action,
  entity,
  entityId,
  at: `2026-11-16T10:${String(60 - id).padStart(2, "0")}:00.000Z`,
});

describe("stillHidden", () => {
  it("keeps what was hidden last, from its own button or the reports queue", () => {
    // Newest first, as the API sends the log.
    const log = [
      entry(1, "thread.unhide", "thread", "7"),
      entry(2, "report.hide", "thread", "9"),
      entry(3, "thread.lock", "thread", "8"),
      entry(4, "thread.hide", "thread", "7"),
      entry(5, "thread.hide", "thread", "8"),
      entry(6, "report.dismiss", "thread", "10"),
    ];
    expect(stillHidden(log, "thread").map((item) => item.entityId)).toEqual(["9", "8"]);
  });

  it("ignores the other kind", () => {
    expect(stillHidden([entry(1, "post.hide", "post", "31")], "thread")).toEqual([]);
    expect(stillHidden([entry(1, "post.hide", "post", "31")], "post")).toHaveLength(1);
  });
});
