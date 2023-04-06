import { Server as ExportedServer, CustomErrorResponse as ExportedCustomErrorResponse } from "./index";

import Server from "./Server";
import { CustomErrorResponse } from "./DTOs/errors";

describe("index.ts exports", () => {
  test("should export Server", () => {
    expect(ExportedServer).toBe(Server);
  });

  test("should export CustomErrorResponse", () => {
    expect(ExportedCustomErrorResponse).toBe(CustomErrorResponse);
  });
});