# Pagination of results

By default when you `GET` a collection, e.g. `https://paataka.cloud/api/_/clown/shoes` you'll get all of the items in that collection and a `count` property telling you how many there are.

This is a bit redundant because you can just check `items.length`.

```js
{
  "count": 200,
  "items": [...] // 200 items
}
```

However if you set `page` in the query-string, you get paginated results. The payload will now include a "page" property which should be the same as the "page" query key. It will also include a `pageCount` and `itemsPerPage` property to make it a little easier to implement paging controls.

```js
{
  "count": 200,
  "items": [ ... ] // 20 items,
  "page": 1,
  "pageCount": 20,
  "itemsPerPage": 10
}
```