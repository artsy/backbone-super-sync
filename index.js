var request = require('superagent'),
    Q = require('q');

var METHOD_MAP = {
  'create': 'post',
  'update': 'put',
  'delete': 'del',
  'read': 'get',
  'patch': 'patch'
};

var send = function (method, model, options, url, data, resolve, reject) {
  var url = (options.url ||
    (typeof model.url == 'function' ? model.url() : model.url));
  var data = (options.data ||
    (method === 'create' || method === 'update' ? model.toJSON() : {}));
  var cacheKey = url + JSON.stringify(data);

  // Allow intercepting of the request object to inject sync-wide things like
  // an oAuth token.
  var req = request[METHOD_MAP[method]](url);
  module.exports.editRequest(req, method, model, options);
  // Inject POST/PUT data in body or GET data in querystring
  if (method == 'create' || method == 'update') {
    req.send(data);
  } else {
    req.query(data);
  }
  // Add common Backbone options like `headers`
  if (options.headers) {
    for(key in options.headers) req.set(key, options.headers[key]);
  }
  req.timeout(2000).end(function(err, res) {
    if (err || !res.ok) {
      error(options, (err || res), reject);
    } else {
      if (options.cache && module.exports.cacheClient) {
        module.exports.cacheClient.set(cacheKey, JSON.stringify({
          body: res.body,
          headers: res.headers
        }));
        module.exports.cacheClient.expire(cacheKey,
          (options.cacheTime || module.exports.defaultCacheTime));
      }
      success(options, res, resolve);
    }
  });
}

var success = function(options, res, resolve) {
  options.res = { headers: res.headers };
  if (options.success) options.success(res.body);
  if (options.complete) options.complete(res.body);
  resolve(res.body);
}

var error = function(options, err, reject) {
  if (options.error) options.error(err);
  if (options.complete) options.complete(err);
  reject(err);
}

module.exports = function(method, model, options) {
  var url = (options.url ||
    (typeof model.url == 'function' ? model.url() : model.url));
  var data = (options.data ||
    (method === 'create' || method === 'update' ? model.toJSON() : {}));
  var cacheKey = url + JSON.stringify(data);

  return Q.promise(function(resolve, reject) {
    if (options.cache && module.exports.cacheClient) {
      module.exports.cacheClient.get(cacheKey, function(err, cachedJSON) {
        if (err) {
          error(options, err, reject);
        } else if (cachedJSON) {
          success(options, JSON.parse(cachedJSON), resolve);
        } else {
          send(method, model, options, url, data, resolve, reject);
        }
      });
    } else {
      send(method, model, options, url, data, resolve, reject);
    }
    model.trigger('request', model, {}, options);
  });
};

// Used to modify request objects mid-flight
module.exports.editRequest = function(req) {};

// When set will look for the cache: true option in requests and use this client
// to naively cache requests.
module.exports.cacheClient = null;
module.exports.defaultCacheTime = 3600;