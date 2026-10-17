
import "dotenv/config";
import { env } from "./config.js";
import { app } from "./app.js";

app.listen(env.PORT, () => {
  console.log(`API server listening on port ${env.PORT}`);
});
