import pkg from "../../../package.json";

/**
 * Application configuration.
 */
const app = {
  ...pkg,
  name: "knit",
  commandPrefix: "🧶",
};

export default app;
