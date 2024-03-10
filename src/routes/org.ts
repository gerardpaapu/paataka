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

  res.json({
    name: org.name,
    key: org.key.toString("base64url"),
    collections: summary,
  });
});

router.post("/:organisation/key", (req, res, next) => {
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

  db.refreshKey(organisation, org.code);
  res.sendStatus(StatusCodes.CREATED);
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

    try {
      // it's fine if the collection already exists
      db.createCollection(organisation, key);
    } catch (e) {}
    for (const item of value) {
      db.addItemToCollection(organisation, key, item);
    }
  }

  res.sendStatus(StatusCodes.CREATED);
});
