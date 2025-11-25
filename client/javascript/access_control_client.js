/**
 * Blockchain Access Control Client Library (JavaScript/TypeScript)
 * Client for interacting with the decentralized access control system
 */

const { ethers } = require('ethers');
const fs = require('fs');

class AccessControlClient {
  /**
   * Initialize the client
   * @param {string} providerUrl - Web3 provider URL (e.g., Infura endpoint)
   * @param {string} contractAddress - Deployed AccessControlManager contract address
   * @param {string} privateKey - Private key for signing transactions (optional for read-only)
   */
  constructor(providerUrl, contractAddress, privateKey = null) {
    this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
    this.contractAddress = contractAddress;
    
    // Load contract ABI
    const contractABI = JSON.parse(
      fs.readFileSync('./abis/AccessControlManager.json', 'utf8')
    ).abi;
    
    if (privateKey) {
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      this.contract = new ethers.Contract(
        contractAddress,
        contractABI,
        this.wallet
      );
      this.address = this.wallet.address;
    } else {
      this.contract = new ethers.Contract(
        contractAddress,
        contractABI,
        this.provider
      );
      this.wallet = null;
      this.address = null;
    }
  }

  /**
   * Create a new role
   * @param {string} roleName - Name of the role
   * @returns {Promise<{roleId: string, txHash: string}>}
   */
  async createRole(roleName) {
    if (!this.wallet) {
      throw new Error('Private key required for transactions');
    }
    
    const roleId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(roleName));
    const tx = await this.contract.createRole(roleId, roleName);
    const receipt = await tx.wait();
    
    return {
      roleId,
      txHash: receipt.transactionHash
    };
  }

  /**
   * Grant a role to a user
   * @param {string} roleName - Name of the role
   * @param {string} userAddress - Ethereum address of the user
   * @returns {Promise<string>} Transaction hash
   */
  async grantRole(roleName, userAddress) {
    if (!this.wallet) {
      throw new Error('Private key required for transactions');
    }
    
    const roleId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(roleName));
    const tx = await this.contract.grantRole(roleId, userAddress);
    const receipt = await tx.wait();
    
    return receipt.transactionHash;
  }

  /**
   * Revoke a role from a user
   * @param {string} roleName - Name of the role
   * @param {string} userAddress - Ethereum address of the user
   * @returns {Promise<string>} Transaction hash
   */
  async revokeRole(roleName, userAddress) {
    if (!this.wallet) {
      throw new Error('Private key required for transactions');
    }
    
    const roleId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(roleName));
    const tx = await this.contract.revokeRole(roleId, userAddress);
    const receipt = await tx.wait();
    
    return receipt.transactionHash;
  }

  /**
   * Add a permission to a role
   * @param {string} roleName - Name of the role
   * @param {string} resource - Resource identifier
   * @param {string} action - Action identifier
   * @returns {Promise<string>} Transaction hash
   */
  async addPermission(roleName, resource, action) {
    if (!this.wallet) {
      throw new Error('Private key required for transactions');
    }
    
    const roleId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(roleName));
    const permission = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(`${resource}:${action}`)
    );
    
    const tx = await this.contract.addPermission(roleId, permission);
    const receipt = await tx.wait();
    
    return receipt.transactionHash;
  }

  /**
   * Check if a user has a specific role
   * @param {string} roleName - Name of the role
   * @param {string} userAddress - Ethereum address of the user
   * @returns {Promise<boolean>}
   */
  async hasRole(roleName, userAddress) {
    const roleId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(roleName));
    return await this.contract.hasRole(roleId, userAddress);
  }

  /**
   * Check if a user has permission to perform an action
   * @param {string} userAddress - Ethereum address of the user
   * @param {string} resource - Resource identifier
   * @param {string} action - Action identifier
   * @returns {Promise<boolean>}
   */
  async checkPermission(userAddress, resource, action) {
    const resourceBytes = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(resource));
    const actionBytes = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(action));
    
    return await this.contract.checkPermission(
      userAddress,
      resourceBytes,
      actionBytes
    );
  }

  /**
   * Get all roles assigned to a user
   * @param {string} userAddress - Ethereum address of the user
   * @returns {Promise<string[]>} Array of role IDs
   */
  async getUserRoles(userAddress) {
    const roles = await this.contract.getUserRoles(userAddress);
    return roles.map(r => r);
  }

  /**
   * Get all permissions for a role
   * @param {string} roleName - Name of the role
   * @returns {Promise<string[]>} Array of permission IDs
   */
  async getRolePermissions(roleName) {
    const roleId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(roleName));
    const permissions = await this.contract.getRolePermissions(roleId);
    return permissions.map(p => p);
  }

  /**
   * Get all roles in the system
   * @returns {Promise<string[]>} Array of role IDs
   */
  async getAllRoles() {
    const roles = await this.contract.getAllRoles();
    return roles.map(r => r);
  }

  /**
   * Get user information
   * @param {string} userAddress - Ethereum address of the user
   * @returns {Promise<Object>}
   */
  async getUserInfo(userAddress) {
    const info = await this.contract.getUserInfo(userAddress);
    return {
      isActive: info[0],
      addedAt: new Date(info[1].toNumber() * 1000),
      roleCount: info[2].toNumber()
    };
  }

  /**
   * Listen for role granted events
   * @param {Function} callback - Callback function(roleId, user, grantedBy)
   */
  onRoleGranted(callback) {
    this.contract.on('RoleGranted', (roleId, user, grantedBy, event) => {
      callback(roleId, user, grantedBy, event);
    });
  }

  /**
   * Listen for role revoked events
   * @param {Function} callback - Callback function(roleId, user, revokedBy)
   */
  onRoleRevoked(callback) {
    this.contract.on('RoleRevoked', (roleId, user, revokedBy, event) => {
      callback(roleId, user, revokedBy, event);
    });
  }

  /**
   * Pause the contract (emergency only)
   * @returns {Promise<string>} Transaction hash
   */
  async pauseContract() {
    if (!this.wallet) {
      throw new Error('Private key required for transactions');
    }
    
    const tx = await this.contract.pause();
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }

  /**
   * Unpause the contract
   * @returns {Promise<string>} Transaction hash
   */
  async unpauseContract() {
    if (!this.wallet) {
      throw new Error('Private key required for transactions');
    }
    
    const tx = await this.contract.unpause();
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }
}

class PolicyRegistryClient {
  /**
   * Initialize the policy registry client
   * @param {string} providerUrl - Web3 provider URL
   * @param {string} contractAddress - Deployed PolicyRegistry contract address
   * @param {string} privateKey - Private key for signing transactions
   */
  constructor(providerUrl, contractAddress, privateKey = null) {
    this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
    this.contractAddress = contractAddress;
    
    const contractABI = JSON.parse(
      fs.readFileSync('./abis/PolicyRegistry.json', 'utf8')
    ).abi;
    
    if (privateKey) {
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      this.contract = new ethers.Contract(
        contractAddress,
        contractABI,
        this.wallet
      );
    } else {
      this.contract = new ethers.Contract(
        contractAddress,
        contractABI,
        this.provider
      );
      this.wallet = null;
    }
  }

  /**
   * Create a new policy
   * @param {string} policyName - Name of the policy
   * @param {string} description - Policy description
   * @param {string} ipfsHash - IPFS hash of the detailed policy document
   * @returns {Promise<{policyId: string, txHash: string}>}
   */
  async createPolicy(policyName, description, ipfsHash) {
    if (!this.wallet) {
      throw new Error('Private key required for transactions');
    }
    
    const policyId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(policyName));
    const ipfsHashBytes = ethers.utils.arrayify(ipfsHash);
    
    const tx = await this.contract.createPolicy(
      policyId,
      policyName,
      description,
      ipfsHashBytes
    );
    const receipt = await tx.wait();
    
    return {
      policyId,
      txHash: receipt.transactionHash
    };
  }

  /**
   * Update an existing policy
   * @param {string} policyName - Name of the policy
   * @param {string} newIpfsHash - New IPFS hash
   * @param {string} changeDescription - Description of changes
   * @returns {Promise<string>} Transaction hash
   */
  async updatePolicy(policyName, newIpfsHash, changeDescription) {
    if (!this.wallet) {
      throw new Error('Private key required for transactions');
    }
    
    const policyId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(policyName));
    const ipfsHashBytes = ethers.utils.arrayify(newIpfsHash);
    
    const tx = await this.contract.updatePolicy(
      policyId,
      ipfsHashBytes,
      changeDescription
    );
    const receipt = await tx.wait();
    
    return receipt.transactionHash;
  }

  /**
   * Get policy information
   * @param {string} policyName - Name of the policy
   * @returns {Promise<Object>}
   */
  async getPolicy(policyName) {
    const policyId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(policyName));
    const result = await this.contract.getPolicy(policyId);
    
    return {
      name: result[0],
      description: result[1],
      ipfsHash: ethers.utils.hexlify(result[2]),
      version: result[3].toNumber(),
      createdAt: new Date(result[4].toNumber() * 1000),
      updatedAt: new Date(result[5].toNumber() * 1000),
      createdBy: result[6],
      lastUpdatedBy: result[7],
      isActive: result[8]
    };
  }

  /**
   * Anchor a batch of logs on the blockchain
   * @param {string} batchHash - IPFS hash of the log batch
   * @param {number} logCount - Number of logs in the batch
   * @returns {Promise<string>} Transaction hash
   */
  async anchorLogBatch(batchHash, logCount) {
    if (!this.wallet) {
      throw new Error('Private key required for transactions');
    }
    
    const batchHashBytes = ethers.utils.arrayify(batchHash);
    
    const tx = await this.contract.anchorLogBatch(batchHashBytes, logCount);
    const receipt = await tx.wait();
    
    return receipt.transactionHash;
  }

  /**
   * Verify integrity of a log batch
   * @param {number} batchId - ID of the batch
   * @param {string} expectedHash - Expected IPFS hash
   * @returns {Promise<boolean>}
   */
  async verifyLogBatch(batchId, expectedHash) {
    const expectedHashBytes = ethers.utils.arrayify(expectedHash);
    return await this.contract.verifyLogBatch(batchId, expectedHashBytes);
  }

  /**
   * Listen for policy created events
   * @param {Function} callback - Callback function(policyId, name, ipfsHash, creator)
   */
  onPolicyCreated(callback) {
    this.contract.on('PolicyCreated', (policyId, name, ipfsHash, creator, event) => {
      callback(policyId, name, ipfsHash, creator, event);
    });
  }

  /**
   * Listen for policy updated events
   * @param {Function} callback - Callback function(policyId, newVersion, ipfsHash, updatedBy)
   */
  onPolicyUpdated(callback) {
    this.contract.on('PolicyUpdated', (policyId, newVersion, ipfsHash, updatedBy, event) => {
      callback(policyId, newVersion, ipfsHash, updatedBy, event);
    });
  }
}

// Example usage
async function example() {
  const PROVIDER_URL = 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY';
  const ACCESS_CONTROL_ADDRESS = '0x...'; // Your deployed contract address
  const PRIVATE_KEY = '0x...'; // Your private key
  
  // Initialize client
  const client = new AccessControlClient(
    PROVIDER_URL,
    ACCESS_CONTROL_ADDRESS,
    PRIVATE_KEY
  );
  
  try {
    // Create a role
    const { roleId, txHash } = await client.createRole('Administrator');
    console.log(`Created role: ${roleId}`);
    console.log(`Transaction: ${txHash}`);
    
    // Grant role to user
    const userAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
    const grantTxHash = await client.grantRole('Administrator', userAddress);
    console.log(`Granted role to ${userAddress}`);
    console.log(`Transaction: ${grantTxHash}`);
    
    // Check if user has role
    const hasRole = await client.hasRole('Administrator', userAddress);
    console.log(`User has Administrator role: ${hasRole}`);
    
    // Add permission
    const permTxHash = await client.addPermission('Administrator', 'database', 'write');
    console.log(`Added permission to role`);
    console.log(`Transaction: ${permTxHash}`);
    
    // Check permission
    const canWrite = await client.checkPermission(userAddress, 'database', 'write');
    console.log(`User can write to database: ${canWrite}`);
    
    // Listen for events
    client.onRoleGranted((roleId, user, grantedBy, event) => {
      console.log(`Role ${roleId} granted to ${user} by ${grantedBy}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

module.exports = {
  AccessControlClient,
  PolicyRegistryClient
};
