// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title RoleHierarchy
 * @dev Manages hierarchical role relationships and permission inheritance
 * @notice Allows roles to inherit permissions from parent roles
 */
contract RoleHierarchy is Ownable, Pausable {
    
    // Role hierarchy structure
    struct RoleNode {
        bytes32 roleId;
        bytes32[] parents;      // Parent roles (roles this role inherits from)
        bytes32[] children;     // Child roles (roles that inherit from this)
        uint256 level;          // Hierarchy level (0 = root, higher = more specific)
        bool exists;
    }
    
    // Storage
    mapping(bytes32 => RoleNode) private roles;
    bytes32[] private rootRoles;  // Roles with no parents
    
    // Events
    event RoleAdded(bytes32 indexed roleId, uint256 level);
    event ParentRoleAdded(bytes32 indexed childRole, bytes32 indexed parentRole);
    event ParentRoleRemoved(bytes32 indexed childRole, bytes32 indexed parentRole);
    event CircularDependencyDetected(bytes32 indexed roleId);
    
    // Modifiers
    modifier roleExists(bytes32 roleId) {
        require(roles[roleId].exists, "Role does not exist in hierarchy");
        _;
    }
    
    // ==================== Role Hierarchy Management ====================
    
    /**
     * @dev Add a new role to the hierarchy
     */
    function addRole(bytes32 roleId) external onlyOwner whenNotPaused {
        require(!roles[roleId].exists, "Role already exists in hierarchy");
        
        RoleNode storage newRole = roles[roleId];
        newRole.roleId = roleId;
        newRole.level = 0;
        newRole.exists = true;
        
        rootRoles.push(roleId);
        
        emit RoleAdded(roleId, 0);
    }
    
    /**
     * @dev Add a parent role relationship (child inherits from parent)
     */
    function addParentRole(bytes32 childRoleId, bytes32 parentRoleId) 
        external 
        onlyOwner 
        whenNotPaused 
        roleExists(childRoleId) 
        roleExists(parentRoleId) 
    {
        require(childRoleId != parentRoleId, "Role cannot be its own parent");
        require(!hasParent(childRoleId, parentRoleId), "Parent relationship already exists");
        require(!wouldCreateCycle(childRoleId, parentRoleId), "Would create circular dependency");
        
        // Add parent to child
        roles[childRoleId].parents.push(parentRoleId);
        
        // Add child to parent
        roles[parentRoleId].children.push(childRoleId);
        
        // Update level
        _updateRoleLevel(childRoleId);
        
        // Remove from root roles if it now has a parent
        if (roles[childRoleId].parents.length == 1) {
            _removeFromRootRoles(childRoleId);
        }
        
        emit ParentRoleAdded(childRoleId, parentRoleId);
    }
    
    /**
     * @dev Remove a parent role relationship
     */
    function removeParentRole(bytes32 childRoleId, bytes32 parentRoleId) 
        external 
        onlyOwner 
        whenNotPaused 
        roleExists(childRoleId) 
        roleExists(parentRoleId) 
    {
        require(hasParent(childRoleId, parentRoleId), "Parent relationship does not exist");
        
        // Remove parent from child
        bytes32[] storage parents = roles[childRoleId].parents;
        for (uint i = 0; i < parents.length; i++) {
            if (parents[i] == parentRoleId) {
                parents[i] = parents[parents.length - 1];
                parents.pop();
                break;
            }
        }
        
        // Remove child from parent
        bytes32[] storage children = roles[parentRoleId].children;
        for (uint i = 0; i < children.length; i++) {
            if (children[i] == childRoleId) {
                children[i] = children[children.length - 1];
                children.pop();
                break;
            }
        }
        
        // Update level
        _updateRoleLevel(childRoleId);
        
        // Add to root roles if it no longer has parents
        if (roles[childRoleId].parents.length == 0) {
            rootRoles.push(childRoleId);
        }
        
        emit ParentRoleRemoved(childRoleId, parentRoleId);
    }
    
    /**
     * @dev Internal function to update role level based on parent hierarchy
     */
    function _updateRoleLevel(bytes32 roleId) private {
        uint256 maxParentLevel = 0;
        bytes32[] storage parents = roles[roleId].parents;
        
        for (uint i = 0; i < parents.length; i++) {
            uint256 parentLevel = roles[parents[i]].level;
            if (parentLevel >= maxParentLevel) {
                maxParentLevel = parentLevel + 1;
            }
        }
        
        roles[roleId].level = maxParentLevel;
        
        // Recursively update children
        bytes32[] storage children = roles[roleId].children;
        for (uint i = 0; i < children.length; i++) {
            _updateRoleLevel(children[i]);
        }
    }
    
    /**
     * @dev Remove role from root roles list
     */
    function _removeFromRootRoles(bytes32 roleId) private {
        for (uint i = 0; i < rootRoles.length; i++) {
            if (rootRoles[i] == roleId) {
                rootRoles[i] = rootRoles[rootRoles.length - 1];
                rootRoles.pop();
                break;
            }
        }
    }
    
    /**
     * @dev Check if adding parent would create a circular dependency
     */
    function wouldCreateCycle(bytes32 childRoleId, bytes32 parentRoleId) 
        public 
        view 
        returns (bool) 
    {
        // If parent inherits from child (directly or indirectly), it would create a cycle
        return isDescendant(parentRoleId, childRoleId);
    }
    
    // ==================== Query Functions ====================
    
    /**
     * @dev Check if a role has a specific parent
     */
    function hasParent(bytes32 childRoleId, bytes32 parentRoleId) 
        public 
        view 
        roleExists(childRoleId) 
        returns (bool) 
    {
        bytes32[] storage parents = roles[childRoleId].parents;
        for (uint i = 0; i < parents.length; i++) {
            if (parents[i] == parentRoleId) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev Check if childRole is a descendant of parentRole (direct or indirect)
     */
    function isDescendant(bytes32 childRoleId, bytes32 ancestorRoleId) 
        public 
        view 
        roleExists(childRoleId) 
        roleExists(ancestorRoleId) 
        returns (bool) 
    {
        if (childRoleId == ancestorRoleId) {
            return false;  // Role is not its own descendant
        }
        
        return _isDescendantRecursive(childRoleId, ancestorRoleId, 0);
    }
    
    /**
     * @dev Recursive helper for isDescendant with depth limit to prevent infinite loops
     */
    function _isDescendantRecursive(
        bytes32 childRoleId, 
        bytes32 ancestorRoleId, 
        uint256 depth
    ) private view returns (bool) {
        // Depth limit to prevent gas exhaustion
        if (depth > 50) {
            return false;
        }
        
        bytes32[] storage parents = roles[childRoleId].parents;
        
        for (uint i = 0; i < parents.length; i++) {
            if (parents[i] == ancestorRoleId) {
                return true;
            }
            
            if (_isDescendantRecursive(parents[i], ancestorRoleId, depth + 1)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * @dev Get all parent roles for a given role
     */
    function getParentRoles(bytes32 roleId) 
        external 
        view 
        roleExists(roleId) 
        returns (bytes32[] memory) 
    {
        return roles[roleId].parents;
    }
    
    /**
     * @dev Get all child roles for a given role
     */
    function getChildRoles(bytes32 roleId) 
        external 
        view 
        roleExists(roleId) 
        returns (bytes32[] memory) 
    {
        return roles[roleId].children;
    }
    
    /**
     * @dev Get all ancestors (parent, grandparent, etc.) for a role
     */
    function getAllAncestors(bytes32 roleId) 
        external 
        view 
        roleExists(roleId) 
        returns (bytes32[] memory) 
    {
        bytes32[] memory ancestors = new bytes32[](100);  // Max 100 ancestors
        uint256 count = 0;
        
        count = _collectAncestors(roleId, ancestors, count, 0);
        
        // Resize array to actual count
        bytes32[] memory result = new bytes32[](count);
        for (uint i = 0; i < count; i++) {
            result[i] = ancestors[i];
        }
        
        return result;
    }
    
    /**
     * @dev Recursive helper to collect all ancestors
     */
    function _collectAncestors(
        bytes32 roleId, 
        bytes32[] memory ancestors, 
        uint256 count,
        uint256 depth
    ) private view returns (uint256) {
        // Depth limit
        if (depth > 50 || count >= 100) {
            return count;
        }
        
        bytes32[] storage parents = roles[roleId].parents;
        
        for (uint i = 0; i < parents.length; i++) {
            bytes32 parentId = parents[i];
            
            // Check if already in list (avoid duplicates)
            bool alreadyIncluded = false;
            for (uint j = 0; j < count; j++) {
                if (ancestors[j] == parentId) {
                    alreadyIncluded = true;
                    break;
                }
            }
            
            if (!alreadyIncluded) {
                ancestors[count] = parentId;
                count++;
                
                // Recursively collect parent's ancestors
                count = _collectAncestors(parentId, ancestors, count, depth + 1);
            }
        }
        
        return count;
    }
    
    /**
     * @dev Get role hierarchy level
     */
    function getRoleLevel(bytes32 roleId) 
        external 
        view 
        roleExists(roleId) 
        returns (uint256) 
    {
        return roles[roleId].level;
    }
    
    /**
     * @dev Get all root roles
     */
    function getRootRoles() 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return rootRoles;
    }
    
    /**
     * @dev Check if role exists in hierarchy
     */
    function roleExistsInHierarchy(bytes32 roleId) 
        external 
        view 
        returns (bool) 
    {
        return roles[roleId].exists;
    }
    
    /**
     * @dev Get role information
     */
    function getRoleInfo(bytes32 roleId) 
        external 
        view 
        roleExists(roleId) 
        returns (
            uint256 level,
            uint256 parentCount,
            uint256 childCount
        ) 
    {
        RoleNode storage role = roles[roleId];
        return (
            role.level,
            role.parents.length,
            role.children.length
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
