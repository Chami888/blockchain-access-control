// abi.js - Contract ABIs (Application Binary Interface)
const AccessControlManagerABI = [
    // Role Management
    {
        "inputs": [{"internalType": "bytes32", "name": "roleId", "type": "bytes32"}, {"internalType": "string", "name": "name", "type": "string"}],
        "name": "createRole",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "roleId", "type": "bytes32"}, {"internalType": "address", "name": "user", "type": "address"}],
        "name": "grantRole",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "roleId", "type": "bytes32"}, {"internalType": "address", "name": "user", "type": "address"}],
        "name": "revokeRole",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "roleId", "type": "bytes32"}, {"internalType": "bytes32", "name": "permission", "type": "bytes32"}],
        "name": "addPermission",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "roleId", "type": "bytes32"}, {"internalType": "bytes32", "name": "permission", "type": "bytes32"}],
        "name": "removePermission",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    // Query Functions
    {
        "inputs": [{"internalType": "bytes32", "name": "roleId", "type": "bytes32"}, {"internalType": "address", "name": "user", "type": "address"}],
        "name": "hasRole",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "user", "type": "address"}, {"internalType": "bytes32", "name": "resource", "type": "bytes32"}, {"internalType": "bytes32", "name": "action", "type": "bytes32"}],
        "name": "checkPermission",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
        "name": "getUserRoles",
        "outputs": [{"internalType": "bytes32[]", "name": "", "type": "bytes32[]"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "roleId", "type": "bytes32"}],
        "name": "getRolePermissions",
        "outputs": [{"internalType": "bytes32[]", "name": "", "type": "bytes32[]"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getAllRoles",
        "outputs": [{"internalType": "bytes32[]", "name": "", "type": "bytes32[]"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "roleId", "type": "bytes32"}],
        "name": "getRoleInfo",
        "outputs": [
            {"internalType": "string", "name": "name", "type": "string"},
            {"internalType": "uint256", "name": "createdAt", "type": "uint256"},
            {"internalType": "address", "name": "createdBy", "type": "address"},
            {"internalType": "uint256", "name": "permissionCount", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
        "name": "getUserInfo",
        "outputs": [
            {"internalType": "bool", "name": "isActive", "type": "bool"},
            {"internalType": "uint256", "name": "addedAt", "type": "uint256"},
            {"internalType": "uint256", "name": "roleCount", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getUserCount",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    // User Management
    {
        "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
        "name": "deactivateUser",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
        "name": "reactivateUser",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    // Events
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "bytes32", "name": "roleId", "type": "bytes32"},
            {"indexed": false, "internalType": "string", "name": "name", "type": "string"},
            {"indexed": true, "internalType": "address", "name": "creator", "type": "address"}
        ],
        "name": "RoleCreated",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "bytes32", "name": "roleId", "type": "bytes32"},
            {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
            {"indexed": true, "internalType": "address", "name": "grantedBy", "type": "address"}
        ],
        "name": "RoleGranted",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "bytes32", "name": "roleId", "type": "bytes32"},
            {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
            {"indexed": true, "internalType": "address", "name": "revokedBy", "type": "address"}
        ],
        "name": "RoleRevoked",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "bytes32", "name": "roleId", "type": "bytes32"},
            {"indexed": true, "internalType": "bytes32", "name": "permission", "type": "bytes32"}
        ],
        "name": "PermissionAdded",
        "type": "event"
    }
];

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AccessControlManagerABI };
}
