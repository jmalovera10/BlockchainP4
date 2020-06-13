var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {
	var config;
	before('setup contract', async () => {
		config = await Test.Config(accounts);
		await config.flightSuretyData.authorizeCaller(
			config.flightSuretyApp.address
		);
	});

	/****************************************************************************************/
	/* Operations and Settings                                                              */
	/****************************************************************************************/

	it(`(multiparty) has correct initial isOperational() value`, async function () {
		// Get operating status
		let status = await config.flightSuretyData.isOperational.call();
		assert.equal(status, true, 'Incorrect initial operating status value');
	});

	it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {
		// Ensure that access is denied for non-Contract Owner account
		let accessDenied = false;
		try {
			await config.flightSuretyData.setOperatingStatus(false, {
				from: config.testAddresses[2],
			});
		} catch (e) {
			accessDenied = true;
		}
		assert.equal(accessDenied, true, 'Access not restricted to Contract Owner');
	});

	it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {
		// Ensure that access is allowed for Contract Owner account
		let accessDenied = false;
		try {
			await config.flightSuretyData.setOperatingStatus(false);
		} catch (e) {
			accessDenied = true;
		}
		assert.equal(
			accessDenied,
			false,
			'Access not restricted to Contract Owner'
		);
	});

	it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {
		await config.flightSuretyData.setOperatingStatus(false);

		let reverted = false;
		try {
			await config.flightSurety.setTestingMode(true);
		} catch (e) {
			reverted = true;
		}
		assert.equal(reverted, true, 'Access not blocked for requireIsOperational');

		// Set it back for other tests to work
		await config.flightSuretyData.setOperatingStatus(true);
	});

	it('(airline) register an Airline when contract is deployed', async () => {
		let result = await config.flightSuretyData.isRegistered.call(
			config.firstAirline
		);
		const airlineAmount = await config.flightSuretyData.registeredAirlinesCount();

		assert.equal(airlineAmount, 1, 'The airline count should be 1');
		assert.equal(result, true, 'First Airline was not created');
	});

	it('(airline) can not register an Airline from non existing airline', async () => {
		try {
			await config.flightSuretyApp.registerAirline(accounts[2], {
				from: accounts[3],
			});
		} catch (e) {}
		let result = await config.flightSuretyData.isRegistered.call(accounts[2]);
		const airlineAmount = await config.flightSuretyData.registeredAirlinesCount();

		assert.equal(airlineAmount, 1, 'The airline count should be 1');
		assert.equal(
			result,
			false,
			'Can create second airline from non airline address'
		);
	});

	it('(airline) can register second Airline from first airline address', async () => {
		try {
			await config.flightSuretyApp.registerAirline(accounts[2], {
				from: config.firstAirline,
			});
		} catch (e) {}
		let result = await config.flightSuretyData.isRegistered.call(accounts[2]);
		const airlineAmount = await config.flightSuretyData.registeredAirlinesCount();

		assert.equal(airlineAmount, 2, 'The airline count should be 2');
		assert.equal(
			result,
			true,
			'Can not create second airline from airline address'
		);

		await config.flightSuretyApp.fund({
			from: accounts[2],
			value: web3.utils.toWei('10', 'ether'),
		});
	});

	it('(airline) can not register third Airline from second airline address', async () => {
		try {
			await config.flightSuretyApp.registerAirline(accounts[3], {
				from: accounts[2],
			});
		} catch (e) {}
		let result = await config.flightSuretyData.isRegistered.call(accounts[3]);
		const airlineAmount = await config.flightSuretyData.registeredAirlinesCount();

		assert.equal(airlineAmount, 2, 'The airline count should be 2');
		assert.equal(
			result,
			false,
			'Can not create second airline from airline address'
		);
	});

	it('(airline) can not register fifth Airline without consensus', async () => {
		try {
			// Enable airline 3
			await config.flightSuretyApp.registerAirline(accounts[4], {
				from: config.firstAirline,
			});
			await config.flightSuretyApp.fund({
				from: accounts[4],
				value: web3.utils.toWei('10', 'ether'),
			});
			//Enable airline 4
			await config.flightSuretyApp.registerAirline(accounts[5], {
				from: config.firstAirline,
			});
			//Enable airline 5
			await config.flightSuretyApp.registerAirline(accounts[6], {
				from: config.firstAirline,
			});
		} catch (e) {
			console.log('THE ERROR', e);
		}
		const isRegistered = await config.flightSuretyData.isRegistered.call(
			accounts[6]
		);
		const airlineAmount = await config.flightSuretyData.registeredAirlinesCount();

		assert.equal(airlineAmount, 4, 'The airline count should be 4');
		assert.equal(
			isRegistered,
			false,
			'Can create airlines without multi approval'
		);
	});

	it('(airline) not founded can not participate', async () => {
		try {
			// Vote 2/4
			await config.flightSuretyApp.registerAirline(accounts[6], {
				from: accounts[5],
			});
		} catch (e) {
			console.log(e.message);
		}
		const isRegistered = await config.flightSuretyData.isRegistered.call(
			accounts[6]
		);
		const airlineAmount = await config.flightSuretyData.registeredAirlinesCount();

		assert.equal(airlineAmount, 4, 'The airline count should be 4');
		assert.equal(
			isRegistered,
			false,
			'Was not resgistered even with consensus'
		);
	});

	it('(airline) multiparty consensus', async () => {
		try {
			// Vote 2/4
			await config.flightSuretyApp.registerAirline(accounts[6], {
				from: accounts[4],
			});
		} catch (e) {
			console.log(e.message);
		}
		const isRegistered = await config.flightSuretyData.isRegistered.call(
			accounts[6]
		);
		const airlineAmount = await config.flightSuretyData.registeredAirlinesCount();

		assert.equal(airlineAmount, 5, 'The airline count should be 5');
		assert.equal(isRegistered, true, 'Was not resgistered even with consensus');
	});
});
