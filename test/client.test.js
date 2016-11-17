'use strict';

const chai = require('chai');
const mocha = require('mocha');
const coMocha = require('co-mocha');
const Promise = require('bluebird');

const Api = require('../src/client');

coMocha(mocha);

const expect = chai.expect;
const assert = chai.assert;


const username = 'user@example.com';
const pw = 'password';

const clientId = 'clientId';
const clientSecret = 'clientSecret';

describe('Api', () => {

  let testApi;
  beforeEach(() => {
    testApi = new Api('https', 'backend.break-out.org', clientId, clientSecret)
  });

  describe('#constructor()', () => {
    it('should create a new instance of Api', () => {
      const httpsApi = new Api("https", "backend.break-out.org", "1234", "5678");
      expect(httpsApi).to.not.be.null;

      const httpApi = new Api("http", "backend.break-out.org", "1234", "5678");
      expect(httpApi).to.not.be.null;
    });

    it('should fail with an invalid protocol', () => {
      expect(() => {
        new Api("httq", "backend.break-out.org", "1234", "5678");
      }).to.throw(Error);
    });

    it('should fail if any required parameter is not provided', () => {

      expect(() => {
        new Api(null, "backend.break-out.org", "1234", "5678");
      }).to.throw(Error);

      expect(() => {
        new Api("http", null, "1234", "5678");
      }).to.throw(Error);

      expect(() => {
        new Api("http", "backend.break-out.org", null, "5678");
      }).to.throw(Error);

      expect(() => {
        new Api("http", "backend.break-out.org", "1234", null);
      }).to.throw(Error);

    })
  });

  describe('#authenticate', () => {
    it('should resolve to an object containing access_token and refresh_token', function*() {
      const res = yield testApi.authenticate(username, pw);
      assert.isTrue(res.hasOwnProperty('access_token'));
      assert.isTrue(res.hasOwnProperty('refresh_token'));
    });

    it('should fail with bad credentials', function*() {
      try {
        const res = yield testApi.authenticate('wronguser@example.com', 'pw');
      } catch (err) {
        assert.isNotNull(err);
      }
    });
  });

  describe('#refreshToken', () => {
    it('should resolve to an object containing again an access_token and refresh_token', function *() {
      const authTokens = yield testApi.authenticate(username, pw);
      const res = yield testApi.refreshToken(authTokens.refresh_token);
      assert.isTrue(res.hasOwnProperty('access_token'));
      assert.isTrue(res.hasOwnProperty('refresh_token'));
    });

    it('should fail with bad credentials', function*() {
      try {
        const res = yield testApi.refreshToken('lorem');
        assert.fail('No Error', 'StatusCodeError', 'Expected an error');
      } catch (err) {
        assert.strictEqual(err.constructor.name, 'StatusCodeError');
      }
    });
  });

  describe('#getCurrentUser', () => {
    it('should fail with bad credentials', function *(){
      try {
        const token = yield testApi.authenticate(username, pw);
        yield testApi.getCurrentUser('someinvalidtoken');
        assert.fail('No Error', 'StatusCodeError', 'Expected an error');
      } catch (err) {
        assert.strictEqual(err.constructor.name, 'StatusCodeError');
      }
    });

    // TODO: Fix description
    it('should resolve to an object containing something', function*(){
      const token = yield testApi.authenticate(username, pw);
      const res = yield testApi.getCurrentUser(token.access_token);
      // TODO: Do some schema matching here!
    });
  });

  describe('#createUser', () => {
    it('should fail if user already exists', function *(){
      try {
        const res = yield testApi.createUser('florian.schmidt.1994@icloud.com', 'pw');
        assert.fail('No Error', 'StatusCodeError', 'Expected an error');
      } catch (err) {
        assert.strictEqual(err.constructor.name, 'StatusCodeError');
        // TODO: Check for correct error message!
      }
    });

    // TODO: Fix description
    it('should resolve to an object containing something', function*(){
      const token = yield testApi.authenticate(username, pw);
      const res = yield testApi.getCurrentUser(token.access_token);
      // TODO: Do some schema matching here!
    });
  });
});
