import serverless from "serverless-http";

import { createServer } from "../../server/index";

export const handler = serverless(createServer());
