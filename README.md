# An API client for the breakout api written in JS

## Usage example
Install the dependency as follows:

`npm install --save breakout-api-client`

And use it like this:

```js
const BreakoutApi = require("breakout-api-client");

const debug = true;
const api = new BreakoutApi("http://localhost:8082", "client_app", "123456789", debug);

async function test() {
    // Perform login for user with email and password
    // A side effect of this operation is that the returned access token
    // is saved in this instance of the class BreakoutApi, so that all following
    // requests are authenticated with the users access_token
    try {
        await api.login("sponsor@example.com", "test");
        const me = await api.getMe();
        console.log(me); // Information about the currently logged in user
    } catch (err) {
        console.log(err.message);
        console.log(err.response.data);
    }
}

test();
```