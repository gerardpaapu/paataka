import express from "express";
import cors, { CorsOptions } from "cors";

import keys from "./routes/keys.ts";
import org from "./routes/org.ts";
import data from "./routes/data.ts";

const app = express();
app.use(cors("*" as CorsOptions));
app.use(express.json());

app.use("/api/keys", keys);
app.use("/api/org", org);
app.use("/api/_", data);

export default app;
