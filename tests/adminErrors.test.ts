import { describe, expect, it } from "vitest";
import { adminErrorMessage } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";

describe("adminErrorMessage", () => {
  it("says a post's text is past the API's limit (413 payload_too_large)", () => {
    expect(adminErrorMessage(new ApiError("Payload too large", 413, "payload_too_large"))).toBe(
      "O texto é demasiado longo: o máximo são 100 000 caracteres.",
    );
  });
});
