const BreakoutApi = require('../src/BreakoutApi');
const chai = require('chai');

const expect = chai.expect;

// constants
const url = "http://localhost:8082";
const clientId = "client_app";
const clientSecret = "123456789";

describe('BreakoutApi', () => {
  describe('fetch postings', () => {

    it('should return an array', async () => {
      const api = new BreakoutApi(url, clientId, clientSecret);
      const postings = await api.fetchPostings(2);

      expect(postings).to.be.a('array');
    });

    it('should show different results on different pages', async () => {
      const api = new BreakoutApi(url, clientId, clientSecret);
      const firstPage = await api.fetchPostings(0);
      const secondPage = await api.fetchPostings(1);

      expect(firstPage[0].text).not.to.equal(secondPage[0].text);
    });
  });

  describe('like a posting', () => {

    let api;
    let postingId;

    before(async () => {
      api = new BreakoutApi(url, clientId, clientSecret);
      await api.login("test@example.com", "test"); // TODO: Create new account
      const posting = await api.uploadPosting("This is a test post");
      postingId = posting.id;
    });

    it('should not fail', async () => {
      await api.likePosting(postingId);
    });
  });
});
