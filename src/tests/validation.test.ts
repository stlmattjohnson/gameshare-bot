import { describe, it, expect } from "vitest";
import { dmShareFlowService } from "../services/dmShareFlowService.js";

describe("validation", () => {
  it("validates server ip", () => {
    expect(dmShareFlowService.validateDetail("SERVER_IP", "1.2.3.4:27015").ok).toBe(true);
    expect(dmShareFlowService.validateDetail("SERVER_IP", "not a host !!!").ok).toBe(false);
  });
});
