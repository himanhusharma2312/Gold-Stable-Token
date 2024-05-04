// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract GoldCoin is ERC20, Ownable, Pausable, ReentrancyGuard {
    AggregatorV3Interface private oracle;
    uint8 public _decimals = 18; 
    string public tokenName;
    string public tokenSymbol;
    uint256 private _totalSupply = 51000000000000000000000000;

    constructor(address _oracleAddress, string memory _tokenName, string memory _symbol) ERC20(_tokenName, _symbol) Ownable(msg.sender) {
        oracle = AggregatorV3Interface(_oracleAddress);
        tokenName = _tokenName;
        tokenSymbol    = _symbol;
        _mint(msg.sender, _totalSupply);
    }

    /**
     * @dev Get the current price of gold from the oracle.
     * @return The current price of gold in USD.
     */
    function getGoldPrice() public view returns (uint256) {
        (, int price, , , ) = oracle.latestRoundData();
        require(price > 0, "Invalid price from oracle");
        return uint256(price);
    }

    /**
     * @dev Mint tokens equivalent to a given amount of gold.
     * @param _goldAmount The amount of gold in grams.
     */
    function mintGold(uint256 _goldAmount) external whenNotPaused nonReentrant {
        uint256 tokenAmount = _goldAmount * (10**uint256(_decimals)) / getGoldPrice();
        _mint(msg.sender, tokenAmount);
    }

    /**
     * @dev Burn tokens and maintain their value equivalent to the current gold price.
     * @param _tokenAmount The amount of tokens to burn.
     */
    function burn(uint256 _tokenAmount) external whenNotPaused nonReentrant {
        uint256 goldEquivalent = _tokenAmount * getGoldPrice() / (10**uint256(_decimals));
        _burn(msg.sender, goldEquivalent);
    }

    /**
     * @dev Transfer tokens, ensuring their value remains pegged to gold.
     * @param recipient The address to receive the tokens.
     * @param amount The amount of tokens to transfer.
     * @return A boolean indicating whether the transfer was successful or not.
     */
    function transfer(address recipient, uint256 amount) public virtual override whenNotPaused nonReentrant returns (bool) {
        uint256 goldEquivalent = amount * getGoldPrice() / (10**uint256(_decimals));
        _transfer(msg.sender, recipient, goldEquivalent);
        return true;
    }

    /**
     * @dev Transfer tokens from one address to another.
     * @param sender The address from which to transfer tokens.
     * @param recipient The address to which to transfer tokens.
     * @param amount The amount of tokens to transfer.
     * @return A boolean indicating whether the transfer was successful or not.
     */
    function transferFrom(address sender, address recipient, uint256 amount) public virtual override whenNotPaused nonReentrant returns (bool) {
        uint256 goldEquivalent = amount * getGoldPrice() / (10**uint256(_decimals));
        _transfer(sender, recipient, goldEquivalent);
        _approve(sender, _msgSender(), allowance(sender, _msgSender()) - amount);
        return true;
    }
}