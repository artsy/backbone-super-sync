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
//
// @param {Function} method
// @param {Object} model
// @param {Object} options
// @return {Object} A Q promise to mimc how Backbone work with jQuery

module.exports = function(method, model, options) {
  var cacheKey = urlDataCacheKey(method, model, options)[2];
  return Q.promise(function(resolve, reject) {
    if (options.cache && module.exports.cacheClient) {
      module.exports.cacheClient.get(cacheKey, function(err, cachedJSON) {
        if (err || cachedJSON) model.trigger('request', model, {}, options);
        if (err) {
          error(options, err, reject);
        } else if (cachedJSON) {
          success(options, JSON.parse(cachedJSON), resolve);
        } else {
          send(method, model, options, resolve, reject);
        }
      });
    } else {
      send(method, model, options, resolve, reject);
    }
  });
};

// Helper to compute the requesting url, params, and cache key based off those
// two. Used when sending a new http request or determing the cache key to read.
//
// @param {Function} method
// @param {Object} model
// @param {Object} options
// @return {Array} Array of [url, data, cacheKey]

var urlDataCacheKey = function(method, model, options) {
  var url = (options.url ||
    (typeof model.url == 'function' ? model.url() : model.url));
  var data = (options.data ||
    (method === 'create' || method === 'update' ? model.toJSON(options) : {}));
  var cacheKey = url + JSON.stringify(data);
  return [url, data, cacheKey];
}

// Builds and sends the actual http request. This reflects the guts of the
// default Backbone.sync logic.
//
// @param {Function} method
// @param {Object} model
// @param {Object} options
// @param {Function} resolve Deferred resolve
// @param {Function} reject  Deferred reject

var send = function (method, model, options, resolve, reject) {
  var url = urlDataCacheKey(method, model, options)[0];
  var data = urlDataCacheKey(method, model, options)[1];
  var cacheKey = urlDataCacheKey(method, model, options)[2];
  var req = request[METHOD_MAP[method]](url);

  // Allow intercepting of the request object to inject sync-wide things like
  // an oAuth token.
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

  // Send the actual http request with a timeout to ensure long hanging
  // requests don't leak memory.
  req.timeout(options.timeout || module.exports.timeout).end(function(err, res) {
    if (err || !res.ok) return error(options, (err || res), reject);
    if (options.cache && module.exports.cacheClient) {
      module.exports.cacheClient.set(cacheKey, JSON.stringify({
        body: res.body,
        headers: res.headers
      }));
      module.exports.cacheClient.expire(cacheKey,
        (options.cacheTime || module.exports.defaultCacheTime));
    }
    success(options, res, resolve);
  });
  model.trigger('request', model, req);
}

// DRYs up resolving the callbacks and deferreds for a successful response,
// whether that's from the cache or a resolved http request.
//
// @param {Object} options Backbone options
// @param {Object} res A response object with { body: {}, headers: {} }
// @param {Function} resolve Deferred resolve

var success = function(options, res, resolve) {
  options.res = { headers: res.headers };
  if (options.success) options.success(res.body);
  if (options.complete) options.complete(res.body);
  resolve(res.body);
}

// DRYs up resolving the callbacks and deferreds for an unsuccessful response,
// whether that's from the cache or a resolved http request.
//
// @param {Object} options Backbone options
// @param {Object} err
// @param {Function} reject  Deferred reject

var error = function(options, err, reject) {
  if (options.error) options.error(err);
  if (options.complete) options.complete(err);
  reject(err);
}

// Configuration that can be overwritten by the user. Includes being able
// to modify the request, a cache client library, default cache expiry, and
// the default timeout for a sent http request.

module.exports.editRequest = function(req) {};
module.exports.cacheClient = null;
module.exports.defaultCacheTime = 3600;
module.exports.timeout = 2000;
