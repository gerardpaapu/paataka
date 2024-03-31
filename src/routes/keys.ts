import express from "express";
import { StatusCodes } from "http-status-codes";

import * as db from "../db.ts";

const router = express.Router();

router.get("/:organisation", (req, res, next) => {
  try {
    const codeString = req.query.code;
    if (!codeString || typeof codeString !== "string") {
      res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ error: "Missing code in query string" });
      return;
    }

    const code = Buffer.from(codeString, "base64url");
    const key = db.getApiKey(req.params.organisation, code);
    if (key != undefined) {
      res.json({ key: key.toString("base64url") });
    }

    res.sendStatus(StatusCodes.NOT_FOUND);
  } catch (e) {
    next(e);
  }
});

router.post("/:organisation", (req, res) => {
  const codeString = req.query.code;
  if (!codeString || typeof codeString !== "string") {
    res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ error: "Missing code in query string" });
    return;
  }

  const code = Buffer.from(codeString, "base64url");
  const key = db.refreshKey(req.params.organisation, code);
  if (key == undefined) {
    res.sendStatus(StatusCodes.NOT_FOUND);
    return;
  }

  res.json({ key: key.toString("base64url") });
});

export default router;
