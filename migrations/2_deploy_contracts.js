const FlightSuretyApp = artifacts.require('FlightSuretyApp');
const FlightSuretyData = artifacts.require('FlightSuretyData');
const fs = require('fs');

module.exports = function (deployer) {
	// SHOULD CHANGE THIS LINE WITH THE FIRST GANACHE GENERATED ADDRESS
	let firstAirline = '0x1aB17968f3D346cb62Fa841f9bEa169F126b06f1';
	deployer.deploy(FlightSuretyData, firstAirline).then(() => {
		return deployer
			.deploy(FlightSuretyApp, FlightSuretyData.address)
			.then(() => {
				let config = {
					localhost: {
						url: 'http://localhost:8545',
						dataAddress: FlightSuretyData.address,
						appAddress: FlightSuretyApp.address,
					},
				};
				fs.writeFileSync(
					__dirname + '/../src/dapp/config.json',
					JSON.stringify(config, null, '\t'),
					'utf-8'
				);
				fs.writeFileSync(
					__dirname + '/../src/server/config.json',
					JSON.stringify(config, null, '\t'),
					'utf-8'
				);
			});
	});
};
