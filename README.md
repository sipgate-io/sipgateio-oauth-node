<img src="https://www.sipgatedesign.com/wp-content/uploads/wort-bildmarke_positiv_2x.jpg" alt="sipgate logo" title="sipgate" align="right" height="112" width="200"/>

# sipgate.io Node.js OAuth example
To demonstrate how to authenticate against the sipgate REST API using the OAuth mechanism, 
we make use of the `/authorization/userinfo` endpoint which provides information about the user. 

> For further information regarding the sipgate REST API please visit https://api.sipgate.com/v2/doc

For educational purposes we do not use an OAuth client library in this example, but if you plan to implement authentication using OAuth in you application we recommend using one. You can find various client libraries here: [https://oauth.net/code/](https://oauth.net/code/).


## What is OAuth and when to use it
OAuth is a standard protocol for authorization. You can find more information on the OAuth website [https://oauth.net/](https://oauth.net/) or on wikipedia [https://en.wikipedia.org/wiki/OAuth](https://en.wikipedia.org/wiki/OAuth).

Applications that use the sipgate REST API on behalf of another user should use the OAuth authentication method instead of Basic Auth.


## Prerequisites
- Node.js >= 10.15.3


## Setup OAuth with sipgate
In order to authenticate against the sipgate REST API via OAuth you first need to create a Client in the sipgate Web App.

You can create a client as follows:

1. Navigate to [console.sipgate.com](https://console.sipgate.com/) and login with your sipgate account credentials.
2. Make sure you are in the **Clients** tab in the left side menu
3. Click the **New client** button
4. Fill out the **New client** dialog (Find information about the Privacy Policy URL and Terms of use URL [here](#privacy-policy-url-and-terms-of-use-url))
5. The **Clients** list should contain your new client
6. Select your client
7. The entries **Id** and **Secret** are `YOUR_CLIENT_ID` and `YOUR_CLIENT_SECRET` required for the configuration of your application (see [Configuration](#configuration))
8. Now you just have to add your `REDIRECT_URI` to your Client by clicking the **Add redirect uri** button and fill in the dialog. In our example we provide a server within the application itself so we use `http://localhost:{port}/oauth` (the default port is `8080`). 

Now your Client is ready to use.


### Privacy Policy URL and Terms of use URL
In the Privacy Policy URL and Terms of use URL you must supply in the **New Client** dialog when creating a new Client to use with OAuth you must supply the Privacy Policy URL and Terms of use URL of the Service you want to use OAuth authorization for. During development and testing you can provide any valid URL but later you must change them.


## Configuration
In the [config.json](./config.json) file located in the project root directory insert `YOUR_CLIENT_ID` and `YOUR_CLIENT_SECRET` obtained in Step 7 above:

```json
...
"clientId": "YOUR_CLIENT_ID",
"clientSecret": "YOUR_CLIENT_SECRET",
...
```

The `oauth_scope` defines what kind of access your Client should have to your account and is specific to your respective application. In this case, since we only want to get your basic account information as an example, the scope `account:read` is sufficient.

```
oauth_scope=account:read
```
> Visit https://developer.sipgate.io/rest-api/oauth2-scopes/ to see all available scopes

The `redirect_uri` which we have previously used in the creation of our Client is supplied to the sipgate login page to specify where you want to be redirected after successful login. As explained above, our application provides a small web server itself that handles HTTP requests directed at `http://localhost:8080/oauth`. In case there is already a service listening on port `8080` of your machine you can choose a different port number, but be sure to adjust both the `redirect_uri` and the `port` property accordingly.

```json
...
"redirectUri": "http://localhost:8080/oauth",
"port": 8080,
...
```


## Install dependencies
Navigate to the project's root directory.

Run the application:
```bash
$ npm install
```


## Execution
Run the application:
```bash
$ npm start
```


## How It Works
The main function of our application looks like this: 

In the [index.js](./index.js) we first load the configuration file [config.json](./config.json).
```javascript
const config = require('./config.json');
```

We then generate a unique identifier `sessionState` for our authorization process so that we can match a server response to our request later. The authorization URI is composed from the properties previously loaded from the configuration file and printed to the console.
```javascript
const sessionState = uuidv4();

const params = {
	client_id: config.clientId,
	redirect_uri: config.redirectUri,
	scope: config.oauthScope,
	response_type: 'code',
	state: sessionState,
};

const queryString = querystring.stringify(params);
const apiAuthUrl = `${config.authUrl}?${queryString}`;

console.log(`Please open the following URL in your browser: \n${apiAuthUrl}`);
```

Opening the link in your browser takes you to the sipgate login page where you need to confirm the scope that your Client is requesting access to before logging in with your sipgate credentials. You are then redirected to `http://localhost:8080/oauth` and our application's web server receives your request.

We create a webserver and pass the `handleRequest` function which should be used for processing the incoming requests.
```javascript
const server = http.createServer(handleRequest);

server.listen(config.port, () => {
	console.log('Server listening on: http://localhost:%s', config.port);
});
```

The function `handleRequest` handles all incoming HTTP requests.
```javascript
const handleRequest = async (request, response) => {
	const requestUrl = url.parse(request.url);

	if (requestUrl.pathname !== '/oauth') {
		response.end();
		return;
	}

	const queryParameter = querystring.parse(requestUrl.query);
	const authorizationCode = queryParameter.code;
	const receivedState = queryParameter.state;

	if (receivedState !== sessionState) {
		console.log('State in the callback does not match the state in the original request.');

		response.end();
		return;
	}

	// Get access token
	const tokens = await retrieveTokens(authorizationCode);

	// Get user information
	const userInformation = await userInfo(tokens.accessToken);

	// Refresh tokens
	const refreshedTokens = await refreshTokens(tokens.refreshToken);

	// Get user information using the refreshed accessToken
	const userInformationWithRefreshedToken = await userInfo(refreshedTokens.accessToken);

	response.end();
};
```
After checking if the pathname of the request url matches `/oauth` we extract the query parameters from the request received from the browser and verify that the state transmitted by the authorization server matches the one initially supplied. In the case of multiple concurrent authorization processes this state also serves to match pairs of request and response. We use the code obtained from the request to fetch a set of tokens from the authorization server and try them out by making an request to the `/authorization/userinfo` endpoint of the REST API. Lastly, we use the refresh token to obtain another set of tokens. Note that this invalidates the previous set.

The `retrieveTokens` function fetches the tokens from the authorization server.
```javascript
const retrieveTokens = async authorizationCode => {
	const requestBody = {
		client_id: config.clientId,
		client_secret: config.clientSecret,
		redirect_uri: config.redirectUri,
		code: authorizationCode,
		grant_type: 'authorization_code',
	};

	const response = await axios.post(config.tokenUrl, querystring.stringify(requestBody), {
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
	});

	return {
		accessToken: response.data.access_token,
		refreshToken: response.data.refresh_token,
	};
};
```
We use Axios to send a POST-Request to the authorization server to obtain a set of tokens (Access-Token and Refresh-Token). The POST-Request must contain the `client_id`, `client_secret`, `redirect_uri`, `code` and `grant_type` as form data.

The `refreshTokens` function is very similar to the `retrieveTokens` function. It differs in that we set the `grant_type` to `refresh_token` to indicate that we want to refresh our token, and provide the `refresh_token` we got from the `retrieveTokens` function instead of the `code`.
> ```javascript
> ...
> refresh_token: refreshToken,
> grant_type: 'refresh_token',
> ...
> ```

To see if authorization with the token works, we query the `/authorization/userinfo` endpoint of the REST API.
```javascript
const userInfo = async accessToken => {
	const options = {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	};

	const response = await axios.get(config.testApiEndpoint, options);

	return response.data;
};
```
To use the token for authorization we set the `Authorization` header to `Bearer` followed by a space and the `accessToken` we obtained with the `retrieveTokens` or `refreshTokens` function.


## Common Issues

### "State in the callback does not match the state in the original request"
Possible reasons are:
- the application was restarted and you used old url again or refreshed the browser tab


### "Error: listen EADDRINUSE: address already in use :::{port}"
Possible reasons are:
- another instance of the application is running
- the port configured in the [config.json](./config.json) file is used by another application


### "Error: listen EACCES: permission denied 0.0.0.0:{port}"
Possible reasons are:
- you do not have the permission to bind to the specified port. This can happen if you use port 80, 443 or another well-known port which you can only bind to if you run the application with superuser privileges


### "invalid parameter: redirect_uri"
Possible reasons are:
- the redirect_uri in the [config.json](./config.json) is invalid or not set
- the redirect_uri is not correctly configured the sipgate Web App (You can find more information about the configuration process in the [Setup OAuth with sipgate](#setup-oauth-with-sipgate) section)


### "client not found" or "invalid client_secret"
Possible reasons are:
- the client_id or client_secret configured in the [config.json](./config.json) is invalid. You can check them in the sipgate Web App. See [Setup OAuth with sipgate](#setup-oauth-with-sipgate)


## Related
+ [OAuth RFC6749](https://tools.ietf.org/html/rfc6749)
+ [oauth.net](https://oauth.net/)
+ [auth0.com/docs/](https://auth0.com/docs/)
+ [github.com/axios/axios](https://github.com/axios/axios)


## Contact Us
Please let us know how we can improve this example. 
If you have a specific feature request or found a bug, please use **Issues** or fork this repository and send a **pull request** with your improvements.


## License
This project is licensed under **The Unlicense** (see [LICENSE file](./LICENSE)).


## External Libraries
This code uses the following external libraries

+ axios:
  + Licensed under the [MIT License](https://opensource.org/licenses/MIT)
  + Website: https://github.com/axios/axios

+ uuid:
  + Licensed under the [MIT License](https://opensource.org/licenses/MIT)
  + Website: https://github.com/kelektiv/node-uuid


----
[sipgate.io](https://www.sipgate.io) | [@sipgateio](https://twitter.com/sipgateio) | [API-doc](https://api.sipgate.com/v2/doc)
