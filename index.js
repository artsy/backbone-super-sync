var request = require('superagent'),
    Q = require('q');

var METHOD_MAP = {
  'create': 'post',
  'update': 'put',
  'delete': 'del',
  'read': 'get',
  'patch': 'patch'
};

// Main exported sync function. Returns a Q promise to mimic Backbone + jQuery,
// if using the built in cache support it will check the cache for data or send
// off the HTTP request.
module.exports = function(method, model, options) {
  var url = (options.url ||
    (typeof model.url == 'function' ? model.url() : model.url));
  var data = (options.data ||
    (method === 'create' || method === 'update' ? model.toJSON(options) : {}));
  var cacheKey = url + JSON.stringify(data);
  var dfd = Q.defer();

  // DRY up success/error handling and HTTP sending request
  var success = function(res) {
    options.res = { headers: res.headers };
    if (options.success) options.success(res.body);
    if (options.complete) options.complete(res.body);
    dfd.resolve(res.body); // TODO: This leaks memory
  }
  var error = function(err) {
    if (options.error) options.error(err);
    if (options.complete) options.complete(err);
    dfd.reject(err); // TODO: This leaks memory
  }
  var send = function() {
    request[METHOD_MAP[method]](url)
      .send(method == 'create' || method == 'update' ? data : null)
      .query(method == 'create' || method == 'update' ? null : data)
      .set(options.headers || {})
      .timeout(options.timeout || module.exports.timeout)
      .end(function(err, res) {
        if (err || !res.ok) return error(err || res);
        // Save result in cache
        if (options.cache && module.exports.cacheClient) {
          module.exports.cacheClient.set(cacheKey, JSON.stringify({
            body: res.body,
            headers: res.headers
          }));
          module.exports.cacheClient.expire(cacheKey,
            (options.cacheTime || module.exports.defaultCacheTime));
        }
        // Resolve success
        success(res);
      });
  }

  // If cached, check cache—otherwise just send. Trigger request regardless
  if (options.cache && module.exports.cacheClient) {
    module.exports.cacheClient.get(cacheKey, function(err, cachedJSON) {
      if (err) {
        error(err);
      } else if (cachedJSON) {
        success(JSON.parse(cachedJSON));
      } else {
        send();
      }
    });
  } else {
    send();
  }
  // model.trigger('request', model, {}, options);

  // Return promise and null out leaky vars
  return dfd.promise.fin(function() {
    dfd = null;
    error = null;
    success = null;
    send = null;
  });
};

// Configuration that can be overwritten by the user. Includes a optional
// cache client library integration, default cache expiry, and
// the default timeout for a sent http request.
module.exports.cacheClient = null;
module.exports.defaultCacheTime = 3600;
module.exports.timeout = 10000;
