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
  const { where, orderBy, dir, itemsPerPage, page } = req.query;
  const opts: db.Features = {};
  if (typeof where === "string" && where.trim().length > 0) {
    opts.where = where;
  }

  if (typeof orderBy === "string" && orderBy.trim().length > 0) {
    opts.orderBy = orderBy;
  }

  if (dir === "asc" || dir === "desc") {
    opts.dir = dir;
  }

  let itemsPerPage_ =
    typeof itemsPerPage === "string" ? parseInt(itemsPerPage, 10) : NaN;
  if (!isNaN(itemsPerPage_)) {
    opts.itemsPerPage = itemsPerPage_;
  }

  let page_ = Number(page);
  if (!isNaN(page_)) {
    opts.page = page_;
  }

  if (!req.user || req.user !== organisation) {
    res
      .status(StatusCodes.UNAUTHORIZED)
      .send({ error: "Invalid or missing bearer token" });
    return;
  }

  try {
    const data = db.getItems(organisation, collection, opts);
    if (data == undefined) {
      res.sendStatus(StatusCodes.NOT_FOUND);
      return;
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
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

router.delete("/:organisation/:collection", async (req, res, next) => {
  const { organisation, collection } = req.params;

  if (!req.user || req.user !== organisation) {
    res
      .status(StatusCodes.UNAUTHORIZED)
      .send({ error: "Invalid or missing bearer token" });
    return;
  }

  const deleted = db.deleteCollection(organisation, collection);
  if (!deleted) {
    res.sendStatus(404);
    return;
  }

  res.sendStatus(204);
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

  const result = db.patchById(organisation, collection, _id, req.body);
  if (result == undefined) {
    res.sendStatus(StatusCodes.NOT_FOUND);
    return;
  }

  res.json(result);
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

router.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): void => {
    if (err.name === "PaatakaExpressionError") {
      res.status(422).send({ error: err.message });
      return;
    }

    next(err);
  },
);
export default router;
