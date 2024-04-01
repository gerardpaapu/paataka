# Getting Started

Once you have an invitation link, you can start creating collections.

Your organisation name will be baked into the link, it'll look something like this:
```
https://paataka.cloud/charlottes-weblog?code=iajsdokkd
```
You create collections by pasting json into the `<textarea />`, that json
should be an object, where each key is an array of objects.

```json
{
	"posts": [],
	"comments": []
}
```

This will create two empty collections "posts" and "comments"

If you want to seed items into this, just put some json objects into the arrays.

Paataka always wants to set the id, so don't give your records built in IDs

The other item on the page you'll want is the API Key, unlike the invite code, you
can easily reset the API key to get a brand new one, you'll use this to authenticate all
your requests.

# Create

You can create a new item in a collection by posting to that collection, e.g.

```js
const res = await request
	.post('https://paataka.cloud/api/_/charlottes-weblog/posts')
	.send({ text: 'Hello' })
	.auth(TOKEN, { type: 'bearer' })
```

# Read

You can either read a list of 

# Update
# Delete
