var HDWalletProvider = require('truffle-hdwallet-provider');
var mnemonic =
	'soap talent yard december circle lesson steak saddle essay high pencil limit';

module.exports = {
	networks: {
		development: {
			host: '127.0.0.1',
			port: '8545',
			network_id: '*',
		},
	},
	compilers: {
		solc: {
			version: '^0.4.24',
		},
	},
};
