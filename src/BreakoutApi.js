'use strict';

const axios = require('axios');
const qs = require('qs');
const Promise = require('bluebird');

function validateNotNullOrUndefined(arg) {
  if (typeof(arg) === 'undefined' || arg === null) {
    throw new Error('Expected argument not be null or undefined');
  }
}

class BreakoutApi {

  constructor(url, clientId, clientSecret, cloudinaryCloud = '', cloudinaryApiKey = '', debug=false) {

    validateNotNullOrUndefined(url);
    validateNotNullOrUndefined(clientId);
    validateNotNullOrUndefined(clientSecret);

    this.url = url;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.cloudinaryCloud = cloudinaryCloud;
    this.cloudinaryApiKey = cloudinaryApiKey;

    this.instance = axios.create({
      baseURL: `${url}`
    });

    if (debug && debug === true) {
      this.registerDebugInterceptor();
    }

  }

  static getClientSideUrl() {
    if (window.location.port) {
      return `${window.location.protocol}//${window.location.hostname}:${window.location.port || 80}`;
    } else {
      return `${window.location.protocol}//${window.location.hostname}`;
    }
  }

  registerDebugInterceptor() {
    this.instance.interceptors.request.use(config => {
      // TODO: use logger
      console.log(`${config.method.toUpperCase()} ${config.url}`);
      return config;
    }, error => {
      return Promise.reject(error);
    });
  }

  /**
   * Perform the at the frontend
   *
   * @param email The users email address
   * @param password The users passworc
   *
   * @return {*|AxiosPromise} A promise that returns
   * the html from the page where the user would normally
   * be redirected to
   */
  frontendLogin(email, password) {
    const data = qs.stringify({
      username: email,
      password: password
    });
    return this.instance.post(`${BreakoutApi.getClientSideUrl()}/login`, data)
      .then(resp => resp.data);
  }

  frontendLogout() {
    return this.instance.get(`${BreakoutApi.getClientSideUrl()}/logout`);
  }

  /**
   * Perform login for user with email and password
   *
   * A side effect of this operation is that the returned access token
   * is saved in this instance of the class BreakoutApi, so that all following
   * requests are authenticated with the users access_token
   *
   * @param email The users email address
   * @param password The users password
   * @returns {*|AxiosPromise} A promise which contains the api response
   */
  async login(email, password) {

    const formData = qs.stringify({
      username: email,
      password: password,
      grant_type: 'password',
      scope: 'read write',
      client_id: this.clientId,
      client_secret: this.clientSecret
    });

    const options = {
      auth: {
        username: this.clientId,
        password: this.clientSecret
      }
    };

    const response = await this.instance.post('/oauth/token', formData, options);
    const data = response.data;
    this.setAccessToken(data.access_token);
    return response.data;
  }

  setAccessToken(accessToken) {
    this.instance.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
  }

  createAccount(email, password) {
    return this.instance.post('/user/', {
      email: email,
      password: password
    }).then(resp => resp.data);
  }

  requestPasswordReset(email) {
    const data = {
      email: email
    };
    return this.instance.post('/user/requestreset/', data).then(resp => resp.data);
  }

  /**
   * Let the user become a participant by submitting the needed data
   *
   * The user needs to be authenticated (via login() or setAccessToken())
   *
   * @param userId The userId of the user to become a participant
   * @param userData The data of the user to become a participant. Can contain:
   *
   * {
   *  "firstname" : "MyFirstName",
   *  "lastname" : "MyLastname",
   *  "participant" : {
   *      "emergencynumber" : "12345678",
   *      "tshirtsize" : "XL",
   *      "phonenumber" : "87654321"
   *   }
   * }
   *
   * @return {*|AxiosPromise} A promise which contains the api response
   */
  becomeParticipant(userId, userData) {
    return this.instance.put(`/user/${userId}/`, userData).then(resp => resp.data);
  }

  /**
   * Get all events for breakout
   *
   * @return {*|AxiosPromise} An array of events
   */
  getAllEvents() {
    return this.instance.get('/event/').then(resp => resp.data);
  }

  async getAllInvitations() {
    const events = await this.getAllEvents();
    let invitations = await Promise.all(events.map(event => this.getInvitations(event.id)));

    // Flatten arrays
    invitations = [].concat.apply([], invitations);

    const teams = await Promise.all(invitations.map(invite => this.getTeamById(invite.team)));

    return invitations.map(invitation => {
      invitation.team = teams.filter(team => (team.id === invitation.team))[0];
      return invitation;
    });
  }


  /**
   * Get all invitations for the authenticated user for a specific event
   *
   * The user needs to be authenticated (via login() or setAccessToken())
   *
   * @param eventId The id of the event for which we want to see all invitations
   * @return {*|AxiosPromise} An array of events
   */
  getInvitations(eventId) {
    return this.instance.get(`/event/${eventId}/team/invitation/`).then(resp => resp.data);
  }

  /**
   * Creates a new team at a specific event
   *
   * The user needs to be authenticated (via login() or setAccessToken())
   *
   * @param eventId
   * @param teamData
   *
   * {
   *    "name": "what an awesome teamname",
   *    "description": "Description of this team"
   * }
   *
   * @return {*|AxiosPromise} An object containing all the data for a newly created team
   *
   */
  createTeam(eventId, teamData) {
    return this.instance.post(`/event/${eventId}/team/`, teamData).then(resp => resp.data);
  }

  getMe() {
    return this.instance.get('/me/').then(resp => resp.data);
  }

  updateUserData(userId, data) {
    return this.instance.put(`/user/${userId}/`, data).then(resp => resp.data);
  }

  async isUserParticipant() {
    const me = await this.getMe();
    if (!me.participant) {
      return false;
    } else {
      return true;
    }
  }

  async joinTeam(teamId) {

    const me = await this.getMe();

    // This hack is needed because request needs some sort of eventId, no matter which one
    // TODO: Fix in backend and then here!
    const events = await this.getAllEvents();
    const someEventId = events[0].id;

    const response = await this.instance.post(`/event/${someEventId}/team/${teamId}/member/`, {
      email: me.email
    });

    return response.data;
  }

  getTeamById(teamId) {
    // -1 as event id, because the route needs param here but not checked in backend
    // TODO: Fix in backend and then here!
    return this.instance.get(`/event/-1/team/${teamId}/`).then(resp => resp.data);
  }

  async inviteToTeam(teamId, email) {

    const team = await this.getTeamById(teamId);
    const event = team.event;

    const data = {
      email: email
    };
    const response = await this.instance.post(`/event/${event}/team/${teamId}/invitation/`, data);
    return response.data;
  }

  async getInvoiceForTeam(teamId) {
    return this.instance.get(`/team/${teamId}/startingfee`).then(resp => resp.data);
  }

  isUserLoggedInAtFrontend() {
    return this.instance.get(`${BreakoutApi.getClientSideUrl()}/isLoggedIn`)
      .then(resp => resp.data.isLoggedIn);
  }

  /**
   * Fetch one page of postings
   *
   * @param page The page which should be fetched
   * @return {*|Axios.Promise}
   */
  fetchPostings(page = 0) {
    const options = {
      params: {
        page: page
      }
    };

    return this.instance.get('/posting/', options).then(resp => resp.data);
  }

  fetchInvoicesForEvent(eventId) {
    return this.instance.get(`sponsoringinvoice/${eventId}/`)
      .then(resp => resp.data);
  }

  signCloudinaryParams(params = {}) {

    const data = params;

    return this.instance.post('/media/signCloudinaryParams/', data).then(resp => resp.data);
  }

  uploadImage(image, signedParams, onProgress = () => {}) {
    if (global.FormData) {
      const form = new global.FormData();

      form.append("api_key", this.cloudinaryApiKey);
      form.append("signature", signedParams.signature);
      form.append("timestamp", signedParams.timestamp);
      form.append("file", image);

      // see https://github.com/axios/axios/issues/382
      const options = {
        transformRequest: [(data, headers) => {
          delete headers.common.Authorization;
          return data
        }],
        onUploadProgress: onProgress
      };

      return axios.post('https://api.cloudinary.com/v1_1/breakout/image/upload',form, options).then(resp => resp.data);
      
    } else {
      throw new Error("Operation only supported in browser");
    }
  }

  uploadImage(image, signedParams, onProgress = () => {}) {
    if (global.FormData) {
      const form = new global.FormData();

      form.append('api_key', this.cloudinaryApiKey);
      form.append('signature', signedParams.signature);
      form.append('timestamp', signedParams.timestamp);
      form.append('file', image.replace(/name=.*;/g, ''));

      // see https://github.com/axios/axios/issues/382
      const options = {
        transformRequest: [(data, headers) => {
          delete headers.common.Authorization;
          return data;
        }],
        onUploadProgress: onProgress
      };

      return axios.post(`https://api.cloudinary.com/v1_1/${this.cloudinaryCloud}/image/upload`, form, options)
        .then(resp => resp.data);
    } else {
      throw new Error('Operation only supported in browser');
    }
  }

  fetchChallengesForTeam(teamId) {
    return this.instance.get(`/team/${teamId}/challenge/`).then(resp => resp.data);
  }

  fetchSponsoringsForTeam(teamId) {
    return this.instance.get(`/team/${teamId}/sponsoring/`).then(resp => resp.data);
  }

  uploadPosting(text = null, location = null, media = null) {
    const data = {
      date: Date.now() / 1000,
    };

    if (location) {
      data.postingLocation = location;
    }

    if (text) {
      data.text = text;
    }

    if (media) {
      data.media = media;
    }

    return this.instance.post('/posting/', data).then(resp => resp.data);
  }

  fetchPostingsForTeam(teamId) {
    return this.instance.get(`/event/-1/team/${teamId}/posting/`).then(resp => resp.data);
  }

  fetchLocationsForEvent(eventId) {
    return this.instance.get(`/event/${eventId}/location/`).then(resp => resp.data);
  }

  fetchLocationsForTeam(teamId, limit = 100) {
    return this.instance.get(`/event/-1/team/${teamId}/location/?perTeam=${limit}`).then(resp => resp.data);
  }

  fullfillChallenge(challengeId, postingId) {
    const data = {
      status: 'WITH_PROOF',
      postingId: postingId
    };
    return this.instance.put(`/event/-1/team/-1/challenge/${challengeId}/status/`, data).then(resp => resp.data);
  }

  fetchInvoicesForEvent(eventId) {
    return this.instance.get(`sponsoringinvoice/${eventId}/`)
      .then(resp => resp.data);
  }

  likePosting(postingId) {
    return this.instance.post(`posting/${postingId}/like/`, {date: Math.floor(new Date().getTime() / 1000)})
      .then(resp => resp.data);
  }

  fetchTeamsForEvent(eventId) {
    return this.instance.get(`event/${eventId}/team/`).then(resp => resp.data);
  }

}

module.exports = BreakoutApi;