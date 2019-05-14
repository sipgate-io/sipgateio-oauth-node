const querystring = require('querystring');
const http = require('http');
const uuidv4 = require('uuid/v4');
const url = require('url');
const axios = require('axios');

const config = require('./config.json');

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

const refreshTokens = async refreshToken => {
	const requestBody = {
		client_id: config.clientId,
		client_secret: config.clientSecret,
		refresh_token: refreshToken,
		grant_type: 'refresh_token',
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

const userInfo = async accessToken => {
	const options = {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	};

	const response = await axios.get(config.testApiEndpoint, options);

	return response.data;
};

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
	console.log('Getting tokens...');
	const tokens = await retrieveTokens(authorizationCode);
	console.log('Received new tokens: \n', tokens);

	// Get user information
	console.log('Getting user information...');
	const userInformation = await userInfo(tokens.accessToken);
	console.log(userInformation);

	// Refresh tokens
	console.log('Refreshing tokens...');
	const refreshedTokens = await refreshTokens(tokens.refreshToken);
	console.log('Received new tokens: \n', tokens);

	// Get user information using the refreshed accessToken
	console.log('Getting user information...');
	const userInformationWithRefreshedToken = await userInfo(refreshedTokens.accessToken);
	console.log(userInformationWithRefreshedToken);

	response.end();
};

const server = http.createServer(handleRequest);

server.listen(config.port, () => {
	console.log('Server listening on: http://localhost:%s', config.port);
});
