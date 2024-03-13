import express from "express";
import { StatusCodes } from "http-status-codes";
import { checkBearer } from "../auth.ts";

import * as db from "../db.ts";
const router = express.Router();

router.use(checkBearer());
// router.get("/:organisation", (req, res, next) => {});

router.post("/:organisation/:collection", (req, res, next) => {
  const { organisation, collection } = req.params;
  const body = req.body;

  if (!req.user || req.user !== organisation) {
    res
      .status(StatusCodes.UNAUTHORIZED)
      .send({ error: "Invalid or missing bearer token" });
    return;
  }

  // TODO: I think we can't get here?
  if (!body || typeof body !== "object") {
    res
      .status(StatusCodes.UNPROCESSABLE_ENTITY)
      .json({ error: "Invalid JSON body" });
    return;
  }

  const id = db.addItemToCollection(organisation, collection, req.body);
  if (!id) {
    res.sendStatus(StatusCodes.NOT_FOUND);
    return;
  }

  const location = `/api/_/${organisation}/${collection}/${id}`;
  res.setHeader("Location", location);
  res.status(StatusCodes.CREATED).json({ "@self": location, id });
});

router.get("/:organisation/:collection", (req, res, next) => {
  const { organisation, collection } = req.params;
  const { where, orderBy, dir } = req.query;
  const opts: Record<string, string | undefined> = {};
  if (typeof where === "string") {
    opts.where = where;
  }

  if (typeof orderBy === "string") {
    opts.orderBy = orderBy;
  }

  if (typeof dir === "string") {
    opts.dir = dir;
  }

  if (!req.user || req.user !== organisation) {
    res
      .status(StatusCodes.UNAUTHORIZED)
      .send({ error: "Invalid or missing bearer token" });
    return;
  }

  const data = db.getItems(organisation, collection, opts);
  if (data == undefined) {
    res.sendStatus(StatusCodes.NOT_FOUND);
    return;
  }

  res.json(data);
});

router.get("/:organisation/:collection/:id", (req, res, next) => {
  const { organisation, collection, id } = req.params;

  if (!req.user || req.user !== organisation) {
    res
      .status(StatusCodes.UNAUTHORIZED)
      .send({ error: "Invalid or missing bearer token" });
    return;
  }

  const _id = parseInt(id, 10);
  if (isNaN(_id)) {
    res.sendStatus(StatusCodes.NOT_FOUND);
    return;
  }

  const data = db.getById(organisation, collection, _id);
  if (!data) {
    res.sendStatus(StatusCodes.NOT_FOUND);
    return;
  }

  res.json(data);
});

router.put("/:organisation/:collection/:id", (req, res, next) => {
  const { organisation, collection, id } = req.params;

  if (!req.user || req.user !== organisation) {
    res
      .status(StatusCodes.UNAUTHORIZED)
      .send({ error: "Invalid or missing bearer token" });
    return;
  }

  const _id = parseInt(id, 10);
  if (isNaN(_id)) {
    res.sendStatus(StatusCodes.NOT_FOUND);
    return;
  }

  const success = db.replaceById(organisation, collection, _id, req.body);
  if (!success) {
    res.sendStatus(StatusCodes.NOT_FOUND);
    return;
  }

  res.sendStatus(StatusCodes.NO_CONTENT);
});

router.patch("/:organisation/:collection/:id", (req, res, next) => {
  const { organisation, collection, id } = req.params;

  if (!req.user || req.user !== organisation) {
    res
      .status(StatusCodes.UNAUTHORIZED)
      .send({ error: "Invalid or missing bearer token" });
    return;
  }

  const _id = parseInt(id, 10);
  if (isNaN(_id)) {
    res.sendStatus(StatusCodes.NOT_FOUND);
    return;
  }

  const success = db.patchById(organisation, collection, _id, req.body);
  if (!success) {
    res.sendStatus(StatusCodes.NOT_FOUND);
    return;
  }

  res.sendStatus(StatusCodes.NO_CONTENT);
});

router.delete("/:organisation/:collection/:id", (req, res, next) => {
  const { organisation, collection, id } = req.params;

  if (!req.user || req.user !== organisation) {
    res
      .status(StatusCodes.UNAUTHORIZED)
      .send({ error: "Invalid or missing bearer token" });
    return;
  }

  const _id = parseInt(id, 10);
  if (isNaN(_id)) {
    res.sendStatus(StatusCodes.NOT_FOUND);
    return;
  }

  const success = db.deleteById(organisation, collection, _id);
  if (!success) {
    res.sendStatus(StatusCodes.NOT_FOUND);
    return;
  }

  res.sendStatus(StatusCodes.NO_CONTENT);
});

export default router;
