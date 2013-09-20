# Backbone Super Sync

A server-side Backbone.sync adapter that does HTTP requests in node using [super-agent](https://github.com/visionmedia/superagent).

## Example

````javascript
var Backbone = require('backbone');
Backbone.sync = require('backbone-server-sync');
````

## Globally adding to the Backbone.sync request

Sometimes you need to add to the requests made by Backbone.sync, such as adding an OAuth token. Backbone Super Sync provides the method `editRequest` to intercept the super-agent request object before the request is made.

````javascript
var Backbone = require('backbone');
superSync = require('backbone-server-sync');
superSync.editRequest(function(req) {
  req.set({ 'X-ACCESS-TOKEN': 'foobar' });
});
Backbone.sync = superSync;
````

## Contributing

Please fork the project and submit a pull request with tests. Run tests with `make test`

## License

MIT