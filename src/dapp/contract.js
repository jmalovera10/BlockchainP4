import Config from './config.json';
import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Web3 from 'web3';

export default class Contract {
	constructor(network, callback) {
		let config = Config[network];
		this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
		this.flightSuretyApp = new this.web3.eth.Contract(
			FlightSuretyApp.abi,
			config.appAddress
		);
		this.initialize(callback);
		this.owner = null;
		this.airlines = [];
		this.flights = [];
		this.passengers = [];
	}

	initialize(callback) {
		this.web3.eth.getAccounts((error, accts) => {
			console.log(accts);
			this.owner = accts[0];
			this.airlines.push(this.owner);

			callback();
		});
	}

	isOperational(callback) {
		let self = this;
		self.flightSuretyApp.methods
			.isOperational()
			.call({ from: self.owner }, callback);
	}

	fetchFlightStatus(airline, flight, callback) {
		let self = this;
		let payload = {
			airline,
			flight,
			timestamp: Math.floor(Date.now() / 1000),
		};
		self.flightSuretyApp.methods
			.fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
			.send({ from: self.owner }, (error, result) => {
				callback(error, payload);
			});
	}

	async registerAirline(airline) {
		try {
			await this.flightSuretyApp.methods
				.registerAirline(airline)
				.send({ from: this.owner });
			const votes = await this.flightSuretyApp.methods
				.votesLeft(airline)
				.call();
			this.airlines.push(airline);
			return {
				address: this.owner,
				votes: votes,
			};
		} catch (error) {
			console.log('ERROR', error);
			return {
				error: error,
			};
		}
	}

	async registerFlight(takeOff, landing, flight, price, from, to) {
		try {
			const priceWei = this.web3.utils.toWei(price.toString(), 'ether');
			await this.flightSuretyApp.methods
				.registerFlight(takeOff, landing, flight, priceWei, from, to)
				.send({ from: this.account });
			this.flights.push({ takeOff, landing, flight, price, from, to });
			return {
				address: this.account,
				error: '',
			};
		} catch (error) {
			return {
				address: this.account,
				error: error,
			};
		}
	}

	fund(amount, callback) {
		let self = this;
		self.flightSuretyApp.methods.fund().send(
			{
				from: self.account,
				value: self.web3.utils.toWei(amount, 'ether'),
			},
			(error, result) => {
				callback(error, { address: self.account, amount: amount });
			}
		);
	}

	async book(flight, to, landing, price, insurance) {
		let total = +price + +insurance;
		total = total.toString();
		const amount = this.web3.utils.toWei(insurance.toString(), 'ether');
		try {
			await this.flightSuretyApp.methods
				.book(flight, to, +landing, amount)
				.send({
					from: this.account,
					value: this.web3.utils.toWei(total.toString(), 'ether'),
				});
			return { passenger: this.account };
		} catch (error) {
			console.log(error);
			return {
				error: error,
			};
		}
	}

	async withdraw() {
		await this.flightSuretyApp.methods.withdraw().send({ from: this.account });
	}
}
