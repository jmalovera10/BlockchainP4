pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";


contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner; // Account used to deploy contract
    bool private operational = true; // Blocks all state changes throughout the contract if false
    mapping(address => bool) public authorizedCallers;
    uint256 public registeredAirlinesCount;
    address public firstAirline;
    address[] internal passengers;
    bytes32[] public flightKeys;
    uint256 public indexFlightKeys = 0;
    mapping(address => uint256) public withdrawals;

    /********************************************************************************************/
    /*                                       STRUCT DEFINITIONS                                  */
    /********************************************************************************************/
    struct Airline {
        bool registered;
        bool funded;
    }

    mapping(address => Airline) public airlines;

    struct Flight {
        bool isRegistered;
        uint8 statusCode;
        uint256 takeOff;
        uint256 landing;
        address airline;
        string flightRef;
        uint256 price;
        string from;
        string to;
        mapping(address => bool) bookings;
        mapping(address => uint256) insurances;
    }

    mapping(bytes32 => Flight) public flights;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    event Paid(address recipient, uint256 amount);
    event Funded(address airline);
    event AirlineRegistered(address origin, address newAirline);
    event Credited(address passenger, uint256 amount);

    /**
     * @dev Constructor
     *      The deploying account becomes contractOwner
     */
    constructor(address _firstAirline) public {
        contractOwner = msg.sender;
        firstAirline = _firstAirline;
        registeredAirlinesCount = 1;
        airlines[firstAirline].registered = true;
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
     * @dev Modifier that requires the "operational" boolean variable to be "true"
     *      This is used on all state changing functions to pause the contract in
     *      the event there is an issue that needs to be fixed
     */
    modifier requireIsOperational() {
        require(operational, "Contract is currently not operational");
        _; // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
     * @dev Modifier that requires the "ContractOwner" account to be the function caller
     */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    // restrict function calls to previously authorized addresses
    modifier callerAuthorized() {
        require(
            authorizedCallers[msg.sender] == true,
            "Address not authorized to call this function"
        );
        _;
    }

    // To avoid spending gas trying to put the contract in a state it already is in

    modifier flightRegistered(bytes32 flightKey) {
        require(flights[flightKey].isRegistered, "This flight does not exist");
        _;
    }

    modifier valWithinRange(
        uint256 val,
        uint256 low,
        uint256 up
    ) {
        require(val < up, "Value higher than max allowed");
        require(val > low, "Value lower than min allowed");
        _;
    }

    /* do not process a flight more than once,
    which could e.g result in the passengers being credited their insurance amount twice.
    */
    modifier notYetProcessed(bytes32 flightKey) {
        require(
            flights[flightKey].statusCode == 0,
            "This flight has already been processed"
        );
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
     * @dev Get operating status of contract
     *
     * @return A bool that is the current operating status
     */

    function isOperational() public view returns (bool) {
        return operational;
    }

    /**
     * @dev Sets contract operations on/off
     *
     * When operational mode is disabled, all write transactions except for this one will fail
     */

    function setOperatingStatus(bool mode) external requireContractOwner {
        operational = mode;
    }

    // function to authorize addresses (especially the App contract!) to call functions from flighSuretyData contract
    function authorizeCaller(address callerAddress)
        external
        requireContractOwner
        requireIsOperational
    {
        authorizedCallers[callerAddress] = true;
    }

    function hasFunded(address airlineAddress)
        external
        view
        returns (bool _hasFunded)
    {
        _hasFunded = airlines[airlineAddress].funded;
    }

    function isRegistered(address airlineAddress)
        external
        view
        returns (bool _registered)
    {
        _registered = airlines[airlineAddress].registered;
    }

    function paxOnFlight(
        address airline,
        string destination,
        uint256 timestamp,
        address passenger
    ) public view returns (bool onFlight) {
        bytes32 flightKey = getFlightKey(airline, destination, timestamp);
        onFlight = flights[flightKey].bookings[passenger];
    }

    function subscribedInsurance(
        address airline,
        string destination,
        uint256 timestamp,
        address passenger
    ) public view returns (uint256 amount) {
        bytes32 flightKey = getFlightKey(airline, destination, timestamp);
        amount = flights[flightKey].insurances[passenger];
    }

    function getFlightPrice(bytes32 flightKey)
        external
        view
        returns (uint256 price)
    {
        price = flights[flightKey].price;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     * @dev Add an airline to the registration queue
     *      Can only be called from FlightSuretyApp contract
     *
     */

    function registerAirline(address airlineAddress, address originAddress)
        external
        requireIsOperational
        callerAuthorized
    {
        registeredAirlinesCount++;
        Airline memory _airline = Airline(true, false);
        airlines[airlineAddress] = _airline;
        emit AirlineRegistered(originAddress, airlineAddress);
    }

    function registerFlight(
        uint256 _takeOff,
        uint256 _landing,
        string _flight,
        uint256 _price,
        string _from,
        string _to,
        address originAddress
    ) external requireIsOperational callerAuthorized {
        require(_takeOff > now, "A flight cannot take off in the past");
        require(_landing > _takeOff, "A flight cannot land before taking off");

        Flight memory flight = Flight(
            true,
            0,
            _takeOff,
            _landing,
            originAddress,
            _flight,
            _price,
            _from,
            _to
        );
        bytes32 flightKey = keccak256(
            abi.encodePacked(originAddress, _flight, _takeOff)
        );
        flights[flightKey] = flight;
        indexFlightKeys = flightKeys.push(flightKey).sub(1);
        // event emission in app contract
    }

    /**
     * @dev Buy insurance for a flight
     *
     */

    function buy(
        bytes32 flightKey,
        uint256 amount,
        address originAddress
    )
        external
        payable
        requireIsOperational
        callerAuthorized
        flightRegistered(flightKey)
    {
        Flight storage flight = flights[flightKey];
        flight.bookings[originAddress] = true;
        flight.insurances[originAddress] = amount;
        passengers.push(originAddress);
        withdrawals[flight.airline] = flight.price;
    }

    /**
     *  @dev Credits payouts to insurees
     */
    function creditInsurees(bytes32 flightKey)
        internal
        requireIsOperational
        flightRegistered(flightKey)
    {
        // get flight
        Flight storage flight = flights[flightKey];
        // loop over passengers and credit them their insurance amount
        for (uint256 i = 0; i < passengers.length; i++) {
            withdrawals[passengers[i]] = flight.insurances[passengers[i]];
            emit Credited(passengers[i], flight.insurances[passengers[i]]);
        }
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
     */
    function pay(address originAddress)
        external
        requireIsOperational
        callerAuthorized
    {
        // Check-Effect-Interaction pattern to protect against re entrancy attack
        // Check
        require(
            withdrawals[originAddress] > 0,
            "No amount to be transferred to this address"
        );
        // Effect
        uint256 amount = withdrawals[originAddress];
        withdrawals[originAddress] = 0;
        // Interaction
        originAddress.transfer(amount);
        emit Paid(originAddress, amount);
    }

    /**
     * @dev Initial funding for the insurance. Unless there are too many delayed flights
     *      resulting in insurance payouts, the contract should be self-sustaining
     *
     */

    function fund(address originAddress)
        public
        payable
        requireIsOperational
        callerAuthorized
    {
        airlines[originAddress].funded = true;
        emit Funded(originAddress);
    }

    function processFlightStatus(bytes32 flightKey, uint8 statusCode)
        external
        flightRegistered(flightKey)
        requireIsOperational
        callerAuthorized
        notYetProcessed(flightKey)
    {
        // Check (modifiers)
        Flight storage flight = flights[flightKey];
        // Effect
        flight.statusCode = statusCode;
        // Interact
        // 20 = "flight delay due to airline"
        if (statusCode == 20) {
            creditInsurees(flightKey);
        }
    }

    function getFlightKey(
        address airline,
        string memory flight,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
     * @dev Fallback function for funding smart contract.
     *
     */
    function() external payable {
        require(msg.data.length == 0);
        fund(msg.sender);
    }
}
