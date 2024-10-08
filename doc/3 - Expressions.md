# Paataka's Expression Language

When getting collections from paataka, results can be filtered and
sorted using a DSL that mimics a very small subset of JavaScript.

These ultimately are compiled to SQL and executed inside sqlite, so
they don't have all the capabilities of real JavaScript

## Identifiers

The basis of most expressions is one of two identifiers:

- `_` represents the current object being filtered or sorted
- `id` represents the id of the current object

## Literals

Numbers and strings can be written with the same syntax as JSON

## Property accessors

dot-accessors and bracket access has the same basic syntax as JavaScript.

Consider this object:

```json
{
  "name": "kevin",
  "height": 7,
  "urls": {
    "x": "https://x.com/kevin"
  }
}
```

These are some expressions we can write and their values
when applied to this object

```js
_.name == "kevin";
_["name"] == "kevin";
_.age == 7;
_.urls.x == "https://x.com/kevin";
_.urls["x"] == "https://x.com/kevin";
_["urls"].x == "https://x.com/kevin";
```

The `.length` property works more or as you might expect for strings and arrays. The length of a string with non-ascii characters will be different because of the difference between sqlite representation and how string.length works for JavaScript strings.

Accessing items in arrays by number does _not_ yet work.

## Comparisons

The following comparisons are available

```
== != >= > < <=
```

So we can ask questions like these of each row

```js
_.age > 7; // is this older than 7?
_.height > _.width; // is this taller than it is wide?
_.author == "James"; // did James write this?
_.genre != "Country"; // is this song acceptable?
```

## Logical combination

logical "and", "or" and "not" are written the same as in JavaScript

```
&& || !
```

This allows us to ask two or more questions in the same expression:

```js
_.height < 1.5 && _.weightKg < 50; // could I carry this person?
!(_.height >= 1.5 || _.weightKg >= 50) // could I carry Augustus De Morgan?
```

## Using expressions in URLs

Expressions are used in the query string of a URL.

Despite that our expression language is designed without concern for what it looks like in a URL, and therefore "how it looks" is "ugly".

For example, behold!

```
https://paataka.cloud/api/_/clown/shoes?where=_.size%20%3E%3D%205%20%26%26%20_.color%20%3D%3D%20%22blue%22
```

This is certainly not pretty, but most of the time when you're using the language you'll likely be using a library like superagent, so it will look like this:

```js
const res = await request
  .get("https://paataka.cloud/api/_/clown/shoes")
  .query({
    where: '_.size >= 5 && _.color == "blue"',
  })
  .auth(API_TOKEN, { type: "bearer" });

const data = res.body;
```

or using web standard APIs:

```js
const url = new URL("https://paataka.cloud/api/_/clown/shoes");
url.params.set("where", '_.size >= 5 && _.color == "blue"');
const res = await fetch(url);
const data = await res.json();
```

So, while there are cases where you end up looking at the URL and it's not-ideal, it is explicitly a non-goal of this
project to care what the query string looks like.

## Filtering objects with "where"

As seen in the above example, using the query key "where", we can filter our objects to a set for which that expression returned true (or truthy).

## Sorting objects with `orderBy`

We can use the query key `orderBy` to sort our results by an expression
and then choose the direction with the `dir` query key. `dir` should either be "asc" or "desc" ("asc" is used by default).

```js
const res = await request
  .get("https://paataka.cloud/api/_/clown/shoes")
  .query({
    orderBy: "_.size",
    dir: "desc",
  })
  .auth(API_TOKEN, { type: "bearer" });
```

## Functions and methods

We implement two methods on strings `.toUpperCase()` and `.toLowerCase()`, these behave similarly to their counterparts in JavaScript.

We implement `array.includes()` to check for specific values inside arrays

Array literals are available, mostly so you can use `.includes()` to
check against multiple values.

```js
["country", "western"].includes(_.genre)
```

Of course, these are not real method-calls, `_.toUpperCase()` is compiled to the SQL function `UPPER(_)` and `_.toLowerCase()` is compiled to `LOWER(_)`, `_.includes()` is compiled to an `EXISTS` sub-query.

The syntax is purely to give the queries a more JavaScript-ish feel.

`like(str, pattern)` which compiles directly to the SQL function `LIKE(pattern, str)` which has the same semantics as the SQL builtin `str LIKE pattern`.

## Weird stuff

The expressions are pretty general, so you can use them on either side
of any operator and you can even look up the value of one property of an object on the same object.

So for this object ...

```json
{
  "active": "green",
  "rangers": {
    "green": "t-rex",
    "pink": "pteradactyl"
  }
}
```

...this expression works

```js
_.rangers[_.active] == "t-rex";
```
