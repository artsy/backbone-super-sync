var express = require('express');
var Backbone = require('backbone');
var superSync = require('./index.js');
var lastRequest, model;

var app = express();
app.get('/foo/bar', function(req, res) {
  lastRequest = req;
  res.send({ foo: 'bar' });
});
app.get('/err', function(req, res) {
  res.send(404, { message: 'Not Found' });
});

describe('Backbone Super Sync', function() {
  
  before(function(done){
    app.listen(5000, done);
  });
  
  beforeEach(function() {
    model = new Backbone.Model;
    model.sync = superSync;
    model.url = 'http://localhost:5000/foo/bar';
  });
  
  context('GET requests', function() {
    
    it('updates the model', function(done) {
      model.fetch({
        success: function() {
          model.get('foo').should.equal('bar');
          done()
        }
      });
    });
    
    it('calls the error callback', function(done) {
      model.url = 'http://localhost:5000/err'
      model.fetch({
        error: function() { done() }
      });
    });
    
    it('accepts data params and adds them to query params', function(done) {
      model.fetch({
        data: { foo: 'bar' },
        success: function() {
          lastRequest.query.foo.should.equal('bar');
          done()
        }
      });
    });
    
  });
  
})