// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title AccessControlManager
 * @dev Central hub for managing role-based access control with blockchain immutability
 * @notice This contract implements RBAC with support for role hierarchies and permission checks
 */
contract AccessControlManager is Ownable, Pausable, ReentrancyGuard {
    
    // Role structure
    struct Role {
        string name;
        bool exists;
        mapping(bytes32 => bool) permissions;
        bytes32[] permissionList;
        uint256 createdAt;
        address createdBy;
    }
    
    // User structure
    struct User {
        address userAddress;
        bytes32[] roles;
        bool isActive;
        uint256 addedAt;
    }
    
    // Storage
    mapping(bytes32 => Role) private roles;
    mapping(address => User) private users;
    mapping(address => mapping(bytes32 => bool)) private userRoles;
    
    bytes32[] private roleList;
    address[] private userList;
    
    // Multi-signature management
    mapping(bytes32 => mapping(address => bool)) private multiSigApprovals;
    mapping(bytes32 => uint256) private multiSigApprovalCount;
    mapping(address => bool) private isAdmin;
    uint256 public requiredApprovals = 2;
    uint256 public adminCount;
    
    // Events
    event RoleCreated(bytes32 indexed roleId, string name, address indexed creator);
    event RoleGranted(bytes32 indexed roleId, address indexed user, address indexed grantedBy);
    event RoleRevoked(bytes32 indexed roleId, address indexed user, address indexed revokedBy);
    event PermissionAdded(bytes32 indexed roleId, bytes32 indexed permission);
    event PermissionRemoved(bytes32 indexed roleId, bytes32 indexed permission);
    event UserDeactivated(address indexed user, address indexed deactivatedBy);
    event UserReactivated(address indexed user, address indexed reactivatedBy);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event MultiSigApprovalGranted(bytes32 indexed operationHash, address indexed admin);
    
    // Modifiers
    modifier onlyAdmin() {
        require(isAdmin[msg.sender], "Not an admin");
        _;
    }
    
    modifier roleExists(bytes32 roleId) {
        require(roles[roleId].exists, "Role does not exist");
        _;
    }
    
    modifier userIsActive(address user) {
        require(users[user].isActive, "User is not active");
        _;
    }
    
    constructor() {
        isAdmin[msg.sender] = true;
        adminCount = 1;
        emit AdminAdded(msg.sender);
    }
    
    // ==================== Admin Management ====================
    
    /**
     * @dev Add a new admin (requires multi-sig approval)
     */
    function addAdmin(address newAdmin) external onlyAdmin whenNotPaused {
        require(!isAdmin[newAdmin], "Already an admin");
        require(newAdmin != address(0), "Invalid address");
        
        bytes32 operationHash = keccak256(abi.encodePacked("addAdmin", newAdmin, block.timestamp));
        
        if (_approveOperation(operationHash)) {
            isAdmin[newAdmin] = true;
            adminCount++;
            emit AdminAdded(newAdmin);
        }
    }
    
    /**
     * @dev Remove an admin (requires multi-sig approval)
     */
    function removeAdmin(address admin) external onlyAdmin whenNotPaused {
        require(isAdmin[admin], "Not an admin");
        require(adminCount > requiredApprovals, "Cannot remove: would break multi-sig");
        
        bytes32 operationHash = keccak256(abi.encodePacked("removeAdmin", admin, block.timestamp));
        
        if (_approveOperation(operationHash)) {
            isAdmin[admin] = false;
            adminCount--;
            emit AdminRemoved(admin);
        }
    }
    
    /**
     * @dev Internal function to handle multi-signature approvals
     */
    function _approveOperation(bytes32 operationHash) private returns (bool) {
        if (!multiSigApprovals[operationHash][msg.sender]) {
            multiSigApprovals[operationHash][msg.sender] = true;
            multiSigApprovalCount[operationHash]++;
            emit MultiSigApprovalGranted(operationHash, msg.sender);
        }
        
        return multiSigApprovalCount[operationHash] >= requiredApprovals;
    }
    
    // ==================== Role Management ====================
    
    /**
     * @dev Create a new role
     */
    function createRole(bytes32 roleId, string memory name) external onlyAdmin whenNotPaused {
        require(!roles[roleId].exists, "Role already exists");
        require(bytes(name).length > 0, "Role name cannot be empty");
        
        Role storage newRole = roles[roleId];
        newRole.name = name;
        newRole.exists = true;
        newRole.createdAt = block.timestamp;
        newRole.createdBy = msg.sender;
        
        roleList.push(roleId);
        
        emit RoleCreated(roleId, name, msg.sender);
    }
    
    /**
     * @dev Add permission to a role
     */
    function addPermission(bytes32 roleId, bytes32 permission) 
        external 
        onlyAdmin 
        whenNotPaused 
        roleExists(roleId) 
    {
        require(!roles[roleId].permissions[permission], "Permission already exists");
        
        roles[roleId].permissions[permission] = true;
        roles[roleId].permissionList.push(permission);
        
        emit PermissionAdded(roleId, permission);
    }
    
    /**
     * @dev Remove permission from a role
     */
    function removePermission(bytes32 roleId, bytes32 permission) 
        external 
        onlyAdmin 
        whenNotPaused 
        roleExists(roleId) 
    {
        require(roles[roleId].permissions[permission], "Permission does not exist");
        
        roles[roleId].permissions[permission] = false;
        
        // Remove from permission list
        bytes32[] storage permissions = roles[roleId].permissionList;
        for (uint i = 0; i < permissions.length; i++) {
            if (permissions[i] == permission) {
                permissions[i] = permissions[permissions.length - 1];
                permissions.pop();
                break;
            }
        }
        
        emit PermissionRemoved(roleId, permission);
    }
    
    // ==================== User Role Assignment ====================
    
    /**
     * @dev Grant a role to a user
     */
    function grantRole(bytes32 roleId, address user) 
        external 
        onlyAdmin 
        whenNotPaused 
        roleExists(roleId) 
        nonReentrant 
    {
        require(user != address(0), "Invalid user address");
        
        if (!userRoles[user][roleId]) {
            userRoles[user][roleId] = true;
            
            if (!users[user].isActive) {
                users[user].userAddress = user;
                users[user].isActive = true;
                users[user].addedAt = block.timestamp;
                userList.push(user);
            }
            
            users[user].roles.push(roleId);
            
            emit RoleGranted(roleId, user, msg.sender);
        }
    }
    
    /**
     * @dev Revoke a role from a user
     */
    function revokeRole(bytes32 roleId, address user) 
        external 
        onlyAdmin 
        whenNotPaused 
        roleExists(roleId) 
        nonReentrant 
    {
        require(userRoles[user][roleId], "User does not have this role");
        
        userRoles[user][roleId] = false;
        
        // Remove from user's role list
        bytes32[] storage userRoleList = users[user].roles;
        for (uint i = 0; i < userRoleList.length; i++) {
            if (userRoleList[i] == roleId) {
                userRoleList[i] = userRoleList[userRoleList.length - 1];
                userRoleList.pop();
                break;
            }
        }
        
        emit RoleRevoked(roleId, user, msg.sender);
    }
    
    // ==================== Permission Checks ====================
    
    /**
     * @dev Check if a user has a specific role
     */
    function hasRole(bytes32 roleId, address user) 
        external 
        view 
        returns (bool) 
    {
        return userRoles[user][roleId] && users[user].isActive;
    }
    
    /**
     * @dev Check if a user has permission to perform an action
     */
    function checkPermission(address user, bytes32 resource, bytes32 action) 
        external 
        view 
        returns (bool) 
    {
        if (!users[user].isActive) {
            return false;
        }
        
        bytes32 permission = keccak256(abi.encodePacked(resource, action));
        
        bytes32[] memory userRoleList = users[user].roles;
        for (uint i = 0; i < userRoleList.length; i++) {
            if (roles[userRoleList[i]].permissions[permission]) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * @dev Check if user has any of the specified permissions
     */
    function hasAnyPermission(address user, bytes32[] calldata permissions) 
        external 
        view 
        returns (bool) 
    {
        if (!users[user].isActive) {
            return false;
        }
        
        bytes32[] memory userRoleList = users[user].roles;
        
        for (uint i = 0; i < permissions.length; i++) {
            for (uint j = 0; j < userRoleList.length; j++) {
                if (roles[userRoleList[j]].permissions[permissions[i]]) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    // ==================== User Management ====================
    
    /**
     * @dev Deactivate a user
     */
    function deactivateUser(address user) 
        external 
        onlyAdmin 
        whenNotPaused 
        userIsActive(user) 
    {
        users[user].isActive = false;
        emit UserDeactivated(user, msg.sender);
    }
    
    /**
     * @dev Reactivate a user
     */
    function reactivateUser(address user) 
        external 
        onlyAdmin 
        whenNotPaused 
    {
        require(!users[user].isActive, "User is already active");
        users[user].isActive = true;
        emit UserReactivated(user, msg.sender);
    }
    
    // ==================== Query Functions ====================
    
    /**
     * @dev Get all roles assigned to a user
     */
    function getUserRoles(address user) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return users[user].roles;
    }
    
    /**
     * @dev Get all permissions for a role
     */
    function getRolePermissions(bytes32 roleId) 
        external 
        view 
        roleExists(roleId) 
        returns (bytes32[] memory) 
    {
        return roles[roleId].permissionList;
    }
    
    /**
     * @dev Get role information
     */
    function getRoleInfo(bytes32 roleId) 
        external 
        view 
        roleExists(roleId) 
        returns (string memory name, uint256 createdAt, address createdBy, uint256 permissionCount) 
    {
        Role storage role = roles[roleId];
        return (role.name, role.createdAt, role.createdBy, role.permissionList.length);
    }
    
    /**
     * @dev Get user information
     */
    function getUserInfo(address user) 
        external 
        view 
        returns (bool isActive, uint256 addedAt, uint256 roleCount) 
    {
        return (users[user].isActive, users[user].addedAt, users[user].roles.length);
    }
    
    /**
     * @dev Get all roles in the system
     */
    function getAllRoles() 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return roleList;
    }
    
    /**
     * @dev Get total number of users
     */
    function getUserCount() 
        external 
        view 
        returns (uint256) 
    {
        return userList.length;
    }
    
    /**
     * @dev Get user at specific index
     */
    function getUserAtIndex(uint256 index) 
        external 
        view 
        returns (address) 
    {
        require(index < userList.length, "Index out of bounds");
        return userList[index];
    }
    
    // ==================== Emergency Controls ====================
    
    /**
     * @dev Pause the contract (requires multi-sig)
     */
    function pause() external onlyAdmin {
        bytes32 operationHash = keccak256(abi.encodePacked("pause", block.timestamp));
        
        if (_approveOperation(operationHash)) {
            _pause();
        }
    }
    
    /**
     * @dev Unpause the contract (requires multi-sig)
     */
    function unpause() external onlyAdmin {
        bytes32 operationHash = keccak256(abi.encodePacked("unpause", block.timestamp));
        
        if (_approveOperation(operationHash)) {
            _unpause();
        }
    }
    
    /**
     * @dev Update required approvals for multi-sig operations
     */
    function updateRequiredApprovals(uint256 newRequired) external onlyAdmin {
        require(newRequired > 0, "Required approvals must be > 0");
        require(newRequired <= adminCount, "Required approvals exceeds admin count");
        
        bytes32 operationHash = keccak256(abi.encodePacked("updateRequired", newRequired, block.timestamp));
        
        if (_approveOperation(operationHash)) {
            requiredApprovals = newRequired;
        }
    }
}
