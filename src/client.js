'use strict';

const Promise = require('bluebird');
const request = Promise.promisifyAll(require('request'));
const assert = require('assert');

class ExtendableError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    this.message = message;
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = (new Error(message)).stack;
    }
  }
}

// now I can extend

class StatusCodeError extends ExtendableError {
  constructor(message) {
    super(message);
  }
}

function isOK(res) {
  if (res.statusCode !== 200) {
    const body = JSON.stringify(JSON.parse(res.body));
    const message = `Expected: 200. Actual: ${res.statusCode}. Response from server: ${body}`;
    throw new StatusCodeError(message, res);
  } else {
    return res;
  }
}

function isCreated(res) {
  if (res.statusCode !== 201) {
    const body = JSON.stringify(JSON.parse(res.body));
    const message = `Expected: 200. Actual: ${res.statusCode}. Response from server: ${body}`;
    throw new StatusCodeError(message, res);
  } else {
    return res;
  }
}

function parseBody(res) {
  return JSON.parse(res.body);
}

class Api {

  constructor(protocol, baseUrl, clientId, clientSecret) {

    assert(protocol !== null);
    assert(baseUrl !== null);
    assert(clientId !== null);
    assert(clientSecret !== null);

    if (!(protocol === 'http' || protocol === 'https')) {
      throw Error(`Invalid protocol ${protocol}`)
    }

    //this.protocol = protocol;
    this.baseUrl = `${protocol}://${baseUrl}`;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  authenticate(username, password) {
    const req = {
      url: `${this.baseUrl}/oauth/token`,
      qs: {
        grant_type: 'password',
        scope: 'read write'
      },
      auth: {
        user: this.clientId,
        pass: this.clientSecret
      },
      form: {
        username: username,
        password: password
      }
    };
    return request
      .postAsync(req)
      .then(isOK)
      .then(parseBody);
  }

  refreshToken(refreshToken) {
    const req = {
      url: `${this.baseUrl}/oauth/token`,
      qs: {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      },
      auth: {
        user: this.clientId,
        pass: this.clientSecret
      }
    };

    return request.postAsync(req)
      .then(isOK)
      .then(parseBody);
  }

  getCurrentUser(accessToken) {
    const req = {
      url: `${this.baseUrl}/me/`,
      auth: {
        bearer: accessToken
      }
    };

    return request.getAsync(req)
      .then(isOK)
      .then(parseBody);
  }

  createUser(email, password) {
    const req = {
      url: `${this.baseUrl}/user/`,
      auth: {
        user: this.clientId,
        pass: this.clientSecret
      },
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({email, password})
    };

    return request.postAsync(req)
      .then(isCreated)
      .then(parseBody);
  }

  uploadPicture(file, mediaObject) {
    const req = {
      url: `${config.media_url}`,
      headers: {'X-UPLOAD-TOKEN': mediaObject.uploadToken},
      formData: {
        id: mediaObject.id,
        file: {
          value: file.buffer,
          options: {
            filename: file.originalname,
            encoding: file.encoding,
            'Content-Type': file.mimetype,
            knownLength: file.size
          }
        }
      }
    };

    return request.postAsync(req).then(parseBody);
  }

  getInvitationByToken(activationToken) {
    const res = {
      url: `${this.baseUrl}/user/invitation`,
      qs: {
        token: activationToken
      }
    };
    return request.getAsync(res).then(parseBody);
  }

  inviteUser(accessToken, eventID, teamID, email) {
    const options = {
      url: `${this.baseUrl}/event/${eventID}/team/${teamID}/invitation/`,
      auth: {
        bearer: accessToken.access_token
      },
      body: JSON.stringify({email: email}),
      headers: {
        'content-type': 'application/json'
      }
    };

    return request.postAsync(options).then(parseBody);
  }

  activeUser(activationToken) {
    const options = {
      url: `${this.baseUrl}/activation`,
      qs: {
        token: activationToken
      }
    };
    return request.getAsync(options).then(parseBody);
  }

  createSponsoring(accessToken, event, team, sponsoringData) {
    const options = {
      url: `${this.baseUrl}/event/${event}/team/${team}/sponsoring/`,
      auth: {
        bearer: accessToken
      },
      body: JSON.stringify(sponsoringData),
      headers: {
        'content-type': 'application/json'
      }
    };

    return request.postAsync(options).then(parseBody);
  }

  getSponsoringsByTeam(eventId, teamId) {
    const options = {
      url: `/event/${eventId}/team/${teamId}/sponsoring/`
    };

    request.getAsync(options).then(parseBody);
  }

  getSponsoringsBySponsor(accessToken, userId) {
    const options = {
      url: `${this.baseUrl}/user/${userId}/sponsor/sponsoring/`,
      auth: {
        bearer: accessToken
      }
    };

    request.getAsync(options).then(parseBody);
  }

  changeSponsoringStatus(accessToken, eventId, teamId, sponsoringId, newStatus) {

    const body = {
      status: newStatus
    };

    const options = {
      url: `${this.baseUrl}/event/${eventId}/team/${teamId}/sponsoring/${sponsoringId}/status/`,
      auth: {
        bearer: accessToken
      },
      body: JSON.stringify(body),
      headers: {
        'content-type': 'application/json'
      }
    };

    request.putAsync(options).then(parseBody);
  }

  acceptSponsoring(accessToken, eventId, teamId, sponsoringId) {
    return this.changeSponsoringStatus(accessToken, eventId, teamId, sponsoringId, 'accepted');
  }

  rejectSponsoring(accessToken, eventId, teamId, sponsoringId) {
    return this.changeSponsoringStatus(accessToken, eventId, teamId, sponsoringId, 'rejected');
  }

  // TODO: This should be renamed to "withdrawSponsoring" to match language
  deleteSponsoring(accessToken, eventId, teamId, sponsoringId) {
    return this.changeSponsoringStatus(accessToken, eventId, teamId, sponsoringId, 'withdrawn');
  }

  createChallenge(token, eventId, teamId, challengeData) {
    const options = {
      url: `${this.baseUrl}/event/${eventId}/team/${teamId}/challenge/`,
      body: JSON.stringify(challengeData),
      headers: {'content-type': 'application/json'},
      auth: {bearer: token.access_token}
    };

    return request.postAsync(options).then(parseBody);
  }

  getChallengesByTeam(eventId, teamId) {
    const options = {
      url: `/event/${eventId}/team/${teamId}/challenge/`
    };

    return request.getAsync(options).then(parseBody);
  }

  getChallengesBySponsor(accessToken, userId) {
    const options = {
      url: `${this.baseUrl}/user/${userId}/sponsor/challenge/`,
      auth: {bearer: accessToken}
    };

    return request.getAsync(options)
      .then(parseBody);
  }

  changeChallengeStatus(accessToken, eventId, teamId, challengeId, newStatus) {

    const body = {
      status: newStatus
    };

    const options = {
      url: `${this.baseUrl}/event/${eventId}/team/${teamId}/challenge/${challengeId}/status/`,
      auth: {bearer: accessToken},
      body: JSON.stringify(body),
      headers: {'content-type': 'application/json'}
    };

    request.putAsync(options)
      .then(parseBody);
  }

  addProofToChallenge(accessToken, challengeId, postingId) {
    const body = {
      status: 'WITH_PROOF',
      postingId: postingId
    };

    const options = {
      url: `${this.baseUrl}/event/1/team/1/challenge/${challengeId}/status/`,
      auth: {bearer: accessToken},
      body: JSON.stringify(body),
      headers: {'content-type': 'application/json'}
    };

    return request.putAsync(options)
      .then(parseBody);
  }

  rejectChallenge(accessToken, eventId, teamId, challengeId) {
    return this.changeStatus(accessToken, eventId, teamId, challengeId, 'rejected');
  }

  acceptChallenge(accessToken, eventId, teamId, challengeId) {
    return this.changeStatus(accessToken, eventId, teamId, challengeId, 'accepted');
  }

  deleteChallenge(accessToken, eventId, teamId, challengeId) {
    return this.changeStatus(accessToken, eventId, teamId, challengeId, 'withdrawn');
  }

  requestPwReset(email) {
    const options = {
      url: `${this.baseUrl}/user/requestreset/`,
      body: JSON.stringify({email: email}),
      headers: {'content-type': 'application/json'}
    };

    request.postAsync(options)
      .then(parseBody);
  }

  resetPassword(email, resetToken, password) {
    const options = {
      url: `${this.baseUrl}/user/passwordreset/`,
      body: JSON.stringify({email: email, token: resetToken, password: password}),
      headers: {'content-type': 'application/json'}
    };

    request.postAsync(options)
      .then(parseBody);
  }

  createGroupMessage(accessToken, userIds) {

    if (!Array.isArray(userIds) && userIds.length > 0) {
      return Promise.reject('userIds has to be array to create groupMessage with more than 0 entries');
    }

    const options = {
      url: `${this.baseUrl}/messaging/`,
      auth: {bearer: accessToken},
      body: JSON.stringify(userIds),
      headers: {'content-type': 'application/json'}
    };
    return request.postAsync(options)
      .then(parseBody);
  }

  addUsersToGroupMessage(accessToken, groupMessageId, userIds) {

    if (!Array.isArray(userIds) && userIds.length > 0) {
      Promise.reject('userIds has to be array to edit groupMessage with more than 0 entries');
    }

    const options = {
      url: `${this.baseUrl}/messaging/${groupMessageId}/`,
      auth: {bearer: accessToken},
      body: JSON.stringify(userIds),
      headers: {'content-type': 'application/json'}
    };
    return request.putAsync(options)
      .then(parseBody);
  }

  getGroupMessage(accessToken, groupMessageId) {

    const options = {
      url: `${this.baseUrl}/messaging/${groupMessageId}/`,
      auth: {bearer: accessToken}
    };
    return request.getAsync(options)
      .then(parseBody);
  }

  addMessageToGroupMessage(accessToken, groupMessageId, text) {

    let body = {};
    body.text = text;
    body.date = Math.floor(new Date().getTime() / 1000);

    const options = {
      url: `${this.baseUrl}/messaging/${groupMessageId}/message/`,
      auth: {bearer: accessToken},
      body: JSON.stringify(body),
      headers: {'content-type': 'application/json'}
    };
    return request.postAsync(options)
      .then(parseBody);
  }

  // Mark: until here "stable"

  createPosting(token, text, uploadMediaTypes, latitude, longitude) {

    let body = {};
    body.text = text;
    if (uploadMediaTypes) body.uploadMediaTypes = uploadMediaTypes;
    if (latitude && longitude) {
      body.postingLocation = {};
      body.postingLocation.latitude = latitude;
      body.postingLocation.longitude = longitude;
    }
    body.date = Math.floor(new Date().getTime() / 1000);
    request.postAsync({
      url: `${this.baseUrl}/posting/`,
      auth: {bearer: token.access_token},
      body: JSON.stringify(body),
      headers: {'content-type': 'application/json'}
    })
      .then(parseBody);
  }

  getAllPostings(token, offset, limit) {

    let options = {
      url: `${this.baseUrl}/posting/`,
      qs: {
        limit: limit,
        offset: offset
      }
    };

    if (token) options.auth = {bearer: token.access_token};

    if (token)options.qs.userid = token.me.id;
    if (offset) options.qs.offset = offset;
    if (limit) options.qs.limit = limit;

    request.getAsync(options)
      .then(parseBody);
  }

  getPosting(postingId, token) {
    let options = {
      url: `${this.baseUrl}/posting/${postingId}/`
    };

    if (token) options.auth = {bearer: token.access_token};
    if (token) options.qs = {userid: token.me.id};


    request.getAsync(options)
      .then(parseBody);
  }

  getPostingsByIds(postingIds, token) {

    let options = {
      url: `${this.baseUrl}/posting/get/ids`,
      body: JSON.stringify(postingIds),
      headers: {'content-type': 'application/json'}
    };

    if (token) options.auth = {bearer: token.access_token};
    if (token) options.qs = {userid: token.me.id};


    if (!Array.isArray(postingIds)) {
      Promise.reject('postingIds has to be array');
    }

    request.post(options)
      .then(parseBody);
  }

  getPostingIdsSince(postingId) {
    return request.getAsync(`/posting/get/since/${postingId}/`);
  }

  getPostingsByHashtag(hashtag, token) {
    let options = {
      url: `${this.baseUrl}/posting/hashtag/${hashtag}/`
    };

    if (token) options.auth = {bearer: token.access_token};
    if (token) options.qs = {userid: token.me.id};


    request.getAsync(options)
      .then(parseBody);

  }

  createComment(token, postingId, text) {


    let body = {};
    body.text = text;
    body.date = Math.floor(new Date().getTime() / 1000);

    request.postAsync({
      url: `${this.baseUrl}/posting/${postingId}/comment/`,
      auth: {bearer: token.access_token},
      body: JSON.stringify(body),
      headers: {'content-type': 'application/json'}
    })
      .then(parseBody);
  }

  createLike(token, postingId) {


    let body = {};
    body.date = Math.floor(new Date().getTime() / 1000);

    request.postAsync({
      url: `${this.baseUrl}/posting/${postingId}/like/`,
      auth: {bearer: token.access_token},
      body: JSON.stringify(body),
      headers: {'content-type': 'application/json'}
    })
      .then(parseBody);
  }

  getLikesForPosting(postingId) {
    return request.getAsync(`/posting/${postingId}/like/`)
      .then(parseBody);
  }

  getTeam(teamId) {
    return request.getAsync(`/event/1/team/${teamId}/`)
      .then(parseBody);
  }

  getPostingIds(teamId) {
    return request.getAsync(`/event/1/team/${teamId}/posting/`)
      .then(parseBody);
  }

  getDistanceByTeam(teamId) {
    return request.getAsync(`/event/1/team/${teamId}/distance/`)
      .then(parseBody);
  }

  getDonationsByTeam(teamId) {
    return request.getAsync(`/event/1/team/${teamId}/donatesum/`)
      .then(parseBody);
  }

  getAllByEvent(eventId) {
    return request.getAsync(`/event/${eventId}/team/`)
      .then(parseBody);
  }

  getEvent(eventId) {
    return request.getAsync(`/event/${eventId}/`)
      .then(parseBody);
  }

  getEvents() {
    return request.getAsync('/event/')
      .then(parseBody);
  }

  getDonateSumByEvent(eventId) {
    return request.getAsync(`/event/${eventId}/donatesum/`)
      .then(parseBody);
  }

  getDistanceByEvent(eventId) {
    return request.getAsync(`/event/${eventId}/distance/`)
      .then(parseBody);
  }

  getUser(userId) {
    return request.getAsync(`/user/${userId}/`)
      .then(parseBody);
  }

  searchForUser(searchString) {
    return request.getAsync(`${this.baseUrl}/user/search/${searchString}/`)
      .then(parseBody);
  }

  getLocationsByTeam(teamId) {
    return request.getAsync(`/event/1/team/${teamId}/location/`)
      .then(parseBody);
  }

  getLocationsByEvent(eventId) {
    return request.getAsync(`/event/${eventId}/location/`)
      .then(parseBody);
  }

  deletePosting(token, postingId) {
    return request.delete({
      url: `${this.baseUrl}/posting/${postingId}/`,
      auth: {bearer: token.access_token}
    }).then(parseBody);
  }

  deleteMedia(token, mediaId) {
    return request.delete({
      url: `${this.baseUrl}/media/${mediaId}/`,
      auth: {bearer: token.access_token}
    }).then(parseBody);
  }

  deleteComment(token, commentId) {
    return request.delete({
      url: `${this.baseUrl}/posting/1/comment/${commentId}/`,
      auth: {bearer: token.access_token}
    }).then(parseBody);
  }

  getAllInvoices(token) {
    request
      .getAsync({
        url: `${this.baseUrl}/invoice/sponsoring/`,
        auth: {bearer: token.access_token}
      }).then(parseBody);
  }

  getInvoicesByTeam(token, teamId) {
    request
      .getAsync({
        url: `${this.baseUrl}/invoice/sponsoring/${teamId}/`,
        auth: {bearer: token.access_token}
      }).then(parseBody);
  }

  addAmountToInvoice(token, invoiceId, amount) {
    request
      .post({
        url: `${this.baseUrl}/invoice/${invoiceId}/payment/`,
        auth: {bearer: token.access_token},
        body: JSON.stringify({
          amount: amount
        }),
        headers: {'content-type': 'application/json'}
      }).then(parseBody);
  }

  createInvoice(token, body) {
    request
      .post({
        url: `${this.baseUrl}/invoice/sponsoring/`,
        auth: {bearer: token.access_token},
        body: JSON.stringify(body),
        headers: {'content-type': 'application/json'}
      }).then(parseBody);
  }
}

module.exports = Api;