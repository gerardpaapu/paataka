# Paataka

`paataka` provides an easy way to set students up with a custom REST-ish JSON API for their own use.

## paataka-client vs. paataka-api

This repo is the API server, deployed to devacademy.life as `paataka-api`.

the frontend application is [paataka-client](https://github.com/dev-academy-programme/paataka-client), which is deployed to `devacademy.life` as `paataka-client`.

Requests from the frontend are [proxied through nginx](https://github.com/dev-academy-programme/paataka-client/blob/main/nginx.conf#L16-L34)

Sometimes when you deploy the api, you'll have to restart the client so that it can see it on the internal network. 

```sh
ssh dokku@devacademy.life ps:restart paataka-client
```

CORS is also terminated at the nginx layer, because it was a performance bottleneck previously.

This setup could probably be simplified in the future, to be like our
other fullstack apps that just embed the react app into the server app.

## Data 

Data in `paataka` is organised into organisations and then collections.

Each organisation can only see data in their own collections.

Collections contain records, which are JSON objects. The convention, is that records within a specific collection are homogenous, but 

## Creating an org 

Create an org in the production environment with the [invite script](https://github.com/dev-academy-programme/invite).

```sh
$ invite paataka the-sparkling-llamas
https://paataka.cloud/the-sparkling-llamas?code=lr1AbOwGoSkZ-FxUJWsJHA
```

you can achieve the same thing manually by running the `./invite` script in the root of the project, via dokku.

This will create an account and log out an authenicated url to the dashboard for that org, e.g.

```sh
$ ssh dokku@devacademy.life run paataka-api ./invite the-sparkline-llamas

https://paataka.cloud/the-sparkling-llamas?code=lr1AbOwGoSkZ-FxUJWsJHA
```

During development, you should run `npm run dev:invite` instead, if you want to create an org in your local database.

## Using the API

Documentation for using the APIs is in the [client repository](https://github.com/dev-academy-programme/paataka-client/blob/main/src/pages/Home/GettingStarted.mdx).

## Database

Paataka stores and processes data as [JSONB](https://www.sqlite.org/json1.html), so it relies on a _fairly recent_ version of sqlite.

Since we're using sqlite specific features and generating some pretty fiddly sql queries, it's not really practical to use knex for this project.

These features are also available in PostgreSQL, so we could support  pg as an options, but it has a slightly different syntax for some things (I think).

## Testing

The vast majority of tests are written as [integration tests](./src/server.test.ts), running an in memory sqlite database and using the endpoints with supertest.

Since parser errors are surfaced to users, we also have [unit tests](./src/expr/parser.test.ts) covering specific syntax errors. These could also have been written as integration tests I guess.

Finally there are [snapshot tests](./src/expr/examples.test.ts) around the output of the expression-to-sql compiler, this is to verify properties such as "the optimiser uses the minimum amount of wrapping and unwrapping". These tests are not critical.