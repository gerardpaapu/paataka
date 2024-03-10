import express from "express";
import * as db from "../db.ts";
import { StatusCodes } from "http-status-codes";

const router = express.Router();
export default router;

router.get("/:organisation", (req, res, next) => {
  const { organisation } = req.params;
  const { code } = req.query;
  const org = db.getOrganisationByName(organisation);
  if (!org) {
    res.sendStatus(StatusCodes.NOT_FOUND);
    return;
  }

  if (code !== org.code.toString("base64url")) {
    res.sendStatus(StatusCodes.UNAUTHORIZED);
    return;
  }
  const summary = db.getCollectionSummary(organisation);

  return {
    key: org.key,
    collections: summary,
  };
});

router.post("/:organisation/seed", (req, res, next) => {
  const { organisation } = req.params;
  const { code } = req.query;
  const org = db.getOrganisationByName(organisation);
  if (!org) {
    res.sendStatus(StatusCodes.NOT_FOUND);
    return;
  }

  if (code !== org.code.toString("base64url")) {
    res.sendStatus(StatusCodes.UNAUTHORIZED);
    return;
  }

  for (const [key, value] of Object.entries(req.body)) {
    if (!Array.isArray(value)) {
      continue;
    }

    const collection = db.createCollection(organisation, key);
    for (const item of value) {
      db.addItemToCollection(organisation, key, item);
    }
  }

  res.sendStatus(StatusCodes.CREATED);
});
