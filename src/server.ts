import express from "express";
import keys from "./routes/keys.ts";

const app = express();

app.use("/api/keys", keys);

export default app;
