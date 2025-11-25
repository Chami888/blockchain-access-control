// config.js - Your Deployed Contract Addresses
const CONFIG = {
    // Network Configuration
    NETWORK: {
        name: "Sepolia Testnet",
        chainId: 11155111,
        rpcUrl: "https://eth-sepolia.g.alchemy.com/v2/sVvFICOG2tNyX4Evnay2V"
    },
    
    // Your Deployed Contract Addresses (from your deployment)
    CONTRACTS: {
        AccessControlManager: "0x88cBDa5EEB8E1e552Bdde51Bbe7B4D707721EebF",
        PolicyRegistry: "0x6f8ab7382cc2Bc481b603Db040Ba45E409236285",
        RoleHierarchy: "0xE1E6376Bfc630844BEc0B58602A0508fa6603223"
    },
    
    // Etherscan URLs for viewing transactions
    ETHERSCAN: {
        baseUrl: "https://sepolia.etherscan.io",
        addressUrl: (address) => `https://sepolia.etherscan.io/address/${address}`,
        txUrl: (txHash) => `https://sepolia.etherscan.io/tx/${txHash}`
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
