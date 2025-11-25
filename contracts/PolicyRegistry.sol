// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title PolicyRegistry
 * @dev Manages access control policies with versioning and IPFS integration
 * @notice Stores policy metadata on-chain with detailed logs stored off-chain on IPFS
 */
contract PolicyRegistry is Ownable, Pausable {
    
    // Policy structure
    struct Policy {
        bytes32 policyId;
        string name;
        string description;
        bytes32 ipfsHash;  // IPFS hash of detailed policy document
        uint256 version;
        uint256 createdAt;
        uint256 updatedAt;
        address createdBy;
        address lastUpdatedBy;
        bool isActive;
    }
    
    // Policy version history
    struct PolicyVersion {
        uint256 version;
        bytes32 ipfsHash;
        uint256 timestamp;
        address updatedBy;
        string changeDescription;
    }
    
    // Storage
    mapping(bytes32 => Policy) private policies;
    mapping(bytes32 => PolicyVersion[]) private policyVersionHistory;
    mapping(bytes32 => mapping(uint256 => bytes32)) private versionToIpfsHash;
    
    bytes32[] private policyList;
    
    // IPFS log batching
    struct LogBatch {
        bytes32 batchHash;  // Hash of aggregated logs
        uint256 logCount;
        uint256 timestamp;
        uint256 startLogId;
        uint256 endLogId;
    }
    
    LogBatch[] private logBatches;
    uint256 private currentLogId;
    
    // Events
    event PolicyCreated(
        bytes32 indexed policyId, 
        string name, 
        bytes32 ipfsHash, 
        address indexed creator
    );
    
    event PolicyUpdated(
        bytes32 indexed policyId, 
        uint256 newVersion, 
        bytes32 ipfsHash, 
        address indexed updatedBy
    );
    
    event PolicyDeactivated(bytes32 indexed policyId, address indexed deactivatedBy);
    event PolicyReactivated(bytes32 indexed policyId, address indexed reactivatedBy);
    
    event LogBatchAnchored(
        uint256 indexed batchId,
        bytes32 batchHash,
        uint256 logCount,
        uint256 startLogId,
        uint256 endLogId
    );
    
    // Modifiers
    modifier policyExists(bytes32 policyId) {
        require(policies[policyId].createdAt > 0, "Policy does not exist");
        _;
    }
    
    modifier policyIsActive(bytes32 policyId) {
        require(policies[policyId].isActive, "Policy is not active");
        _;
    }
    
    // ==================== Policy Management ====================
    
    /**
     * @dev Create a new policy
     */
    function createPolicy(
        bytes32 policyId,
        string memory name,
        string memory description,
        bytes32 ipfsHash
    ) external onlyOwner whenNotPaused {
        require(policies[policyId].createdAt == 0, "Policy already exists");
        require(bytes(name).length > 0, "Policy name cannot be empty");
        require(ipfsHash != bytes32(0), "IPFS hash cannot be empty");
        
        Policy storage newPolicy = policies[policyId];
        newPolicy.policyId = policyId;
        newPolicy.name = name;
        newPolicy.description = description;
        newPolicy.ipfsHash = ipfsHash;
        newPolicy.version = 1;
        newPolicy.createdAt = block.timestamp;
        newPolicy.updatedAt = block.timestamp;
        newPolicy.createdBy = msg.sender;
        newPolicy.lastUpdatedBy = msg.sender;
        newPolicy.isActive = true;
        
        // Store first version
        PolicyVersion memory firstVersion = PolicyVersion({
            version: 1,
            ipfsHash: ipfsHash,
            timestamp: block.timestamp,
            updatedBy: msg.sender,
            changeDescription: "Initial policy creation"
        });
        
        policyVersionHistory[policyId].push(firstVersion);
        versionToIpfsHash[policyId][1] = ipfsHash;
        
        policyList.push(policyId);
        
        emit PolicyCreated(policyId, name, ipfsHash, msg.sender);
    }
    
    /**
     * @dev Update an existing policy
     */
    function updatePolicy(
        bytes32 policyId,
        bytes32 newIpfsHash,
        string memory changeDescription
    ) external onlyOwner whenNotPaused policyExists(policyId) policyIsActive(policyId) {
        require(newIpfsHash != bytes32(0), "IPFS hash cannot be empty");
        
        Policy storage policy = policies[policyId];
        policy.version++;
        policy.ipfsHash = newIpfsHash;
        policy.updatedAt = block.timestamp;
        policy.lastUpdatedBy = msg.sender;
        
        // Store version history
        PolicyVersion memory newVersion = PolicyVersion({
            version: policy.version,
            ipfsHash: newIpfsHash,
            timestamp: block.timestamp,
            updatedBy: msg.sender,
            changeDescription: changeDescription
        });
        
        policyVersionHistory[policyId].push(newVersion);
        versionToIpfsHash[policyId][policy.version] = newIpfsHash;
        
        emit PolicyUpdated(policyId, policy.version, newIpfsHash, msg.sender);
    }
    
    /**
     * @dev Deactivate a policy
     */
    function deactivatePolicy(bytes32 policyId) 
        external 
        onlyOwner 
        whenNotPaused 
        policyExists(policyId) 
        policyIsActive(policyId) 
    {
        policies[policyId].isActive = false;
        emit PolicyDeactivated(policyId, msg.sender);
    }
    
    /**
     * @dev Reactivate a policy
     */
    function reactivatePolicy(bytes32 policyId) 
        external 
        onlyOwner 
        whenNotPaused 
        policyExists(policyId) 
    {
        require(!policies[policyId].isActive, "Policy is already active");
        policies[policyId].isActive = true;
        emit PolicyReactivated(policyId, msg.sender);
    }
    
    // ==================== IPFS Log Batching ====================
    
    /**
     * @dev Anchor a batch of access logs stored on IPFS
     * @param batchHash IPFS hash of the aggregated log batch
     * @param logCount Number of logs in this batch
     */
    function anchorLogBatch(bytes32 batchHash, uint256 logCount) 
        external 
        onlyOwner 
        whenNotPaused 
    {
        require(batchHash != bytes32(0), "Batch hash cannot be empty");
        require(logCount > 0, "Log count must be greater than 0");
        
        uint256 startLogId = currentLogId + 1;
        uint256 endLogId = currentLogId + logCount;
        
        LogBatch memory newBatch = LogBatch({
            batchHash: batchHash,
            logCount: logCount,
            timestamp: block.timestamp,
            startLogId: startLogId,
            endLogId: endLogId
        });
        
        logBatches.push(newBatch);
        currentLogId = endLogId;
        
        emit LogBatchAnchored(
            logBatches.length - 1,
            batchHash,
            logCount,
            startLogId,
            endLogId
        );
    }
    
    /**
     * @dev Verify if a log batch hash is anchored
     */
    function verifyLogBatch(uint256 batchId, bytes32 expectedHash) 
        external 
        view 
        returns (bool) 
    {
        require(batchId < logBatches.length, "Batch ID does not exist");
        return logBatches[batchId].batchHash == expectedHash;
    }
    
    // ==================== Query Functions ====================
    
    /**
     * @dev Get policy information
     */
    function getPolicy(bytes32 policyId) 
        external 
        view 
        policyExists(policyId) 
        returns (
            string memory name,
            string memory description,
            bytes32 ipfsHash,
            uint256 version,
            uint256 createdAt,
            uint256 updatedAt,
            address createdBy,
            address lastUpdatedBy,
            bool isActive
        ) 
    {
        Policy storage policy = policies[policyId];
        return (
            policy.name,
            policy.description,
            policy.ipfsHash,
            policy.version,
            policy.createdAt,
            policy.updatedAt,
            policy.createdBy,
            policy.lastUpdatedBy,
            policy.isActive
        );
    }
    
    /**
     * @dev Get specific version of a policy
     */
    function getPolicyVersion(bytes32 policyId, uint256 version) 
        external 
        view 
        policyExists(policyId) 
        returns (bytes32 ipfsHash) 
    {
        require(version > 0 && version <= policies[policyId].version, "Invalid version");
        return versionToIpfsHash[policyId][version];
    }
    
    /**
     * @dev Get complete version history for a policy
     */
    function getPolicyVersionHistory(bytes32 policyId) 
        external 
        view 
        policyExists(policyId) 
        returns (PolicyVersion[] memory) 
    {
        return policyVersionHistory[policyId];
    }
    
    /**
     * @dev Get all policies
     */
    function getAllPolicies() 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return policyList;
    }
    
    /**
     * @dev Get policy count
     */
    function getPolicyCount() 
        external 
        view 
        returns (uint256) 
    {
        return policyList.length;
    }
    
    /**
     * @dev Get log batch information
     */
    function getLogBatch(uint256 batchId) 
        external 
        view 
        returns (
            bytes32 batchHash,
            uint256 logCount,
            uint256 timestamp,
            uint256 startLogId,
            uint256 endLogId
        ) 
    {
        require(batchId < logBatches.length, "Batch ID does not exist");
        LogBatch storage batch = logBatches[batchId];
        return (
            batch.batchHash,
            batch.logCount,
            batch.timestamp,
            batch.startLogId,
            batch.endLogId
        );
    }
    
    /**
     * @dev Get total number of log batches
     */
    function getLogBatchCount() 
        external 
        view 
        returns (uint256) 
    {
        return logBatches.length;
    }
    
    /**
     * @dev Get current log ID
     */
    function getCurrentLogId() 
        external 
        view 
        returns (uint256) 
    {
        return currentLogId;
    }
    
    /**
     * @dev Get latest log batch
     */
    function getLatestLogBatch() 
        external 
        view 
        returns (
            bytes32 batchHash,
            uint256 logCount,
            uint256 timestamp,
            uint256 startLogId,
            uint256 endLogId
        ) 
    {
        require(logBatches.length > 0, "No log batches exist");
        LogBatch storage batch = logBatches[logBatches.length - 1];
        return (
            batch.batchHash,
            batch.logCount,
            batch.timestamp,
            batch.startLogId,
            batch.endLogId
        );
    }
    
    // ==================== Emergency Controls ====================
    
    /**
     * @dev Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
