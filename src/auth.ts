import passport from "passport";
import { Strategy as BearerStrategy } from "passport-http-bearer";
import * as db from "./db.ts";

passport.use(
  new BearerStrategy((token, cb) => {
    process.nextTick(() => {
      try {
        const key = Buffer.from(token, "base64url");
        const organisation = db.validateKey(key);
        if (!organisation) {
          return cb(null, false);
        }
        return cb(null, organisation);
      } catch (err) {
        return cb(err);
      }
    });
  }),
);

export function checkBearer() {
  return passport.authenticate("bearer", { session: false });
}
