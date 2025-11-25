// test/AccessControlManager.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AccessControlManager", function () {
  let accessControlManager;
  let owner, admin1, admin2, user1, user2;
  
  beforeEach(async function () {
    [owner, admin1, admin2, user1, user2] = await ethers.getSigners();
    
    const AccessControlManager = await ethers.getContractFactory("AccessControlManager");
    accessControlManager = await AccessControlManager.deploy();
    await accessControlManager.deployed();
  });

  describe("Deployment", function () {
    it("Should set the deployer as the first admin", async function () {
      expect(await accessControlManager.adminCount()).to.equal(1);
    });

    it("Should have required approvals set to 2", async function () {
      expect(await accessControlManager.requiredApprovals()).to.equal(2);
    });
  });

  describe("Role Management", function () {
    it("Should create a new role", async function () {
      const roleName = "Administrator";
      const roleId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(roleName));
      
      await expect(accessControlManager.createRole(roleId, roleName))
        .to.emit(accessControlManager, "RoleCreated")
        .withArgs(roleId, roleName, owner.address);
      
      const roles = await accessControlManager.getAllRoles();
      expect(roles).to.include(roleId);
    });

    it("Should not allow creating duplicate roles", async function () {
      const roleName = "Administrator";
      const roleId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(roleName));
      
      await accessControlManager.createRole(roleId, roleName);
      
      await expect(
        accessControlManager.createRole(roleId, roleName)
      ).to.be.revertedWith("Role already exists");
    });

    it("Should not allow empty role names", async function () {
      const roleId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
      
      await expect(
        accessControlManager.createRole(roleId, "")
      ).to.be.revertedWith("Role name cannot be empty");
    });
  });

  describe("Permission Management", function () {
    let roleId, permission;

    beforeEach(async function () {
      const roleName = "Manager";
      roleId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(roleName));
      await accessControlManager.createRole(roleId, roleName);
      
      const resource = "database";
      const action = "read";
      permission = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(`${resource}:${action}`)
      );
    });

    it("Should add permission to role", async function () {
      await expect(accessControlManager.addPermission(roleId, permission))
        .to.emit(accessControlManager, "PermissionAdded")
        .withArgs(roleId, permission);
      
      const permissions = await accessControlManager.getRolePermissions(roleId);
      expect(permissions).to.include(permission);
    });

    it("Should not allow adding duplicate permissions", async function () {
      await accessControlManager.addPermission(roleId, permission);
      
      await expect(
        accessControlManager.addPermission(roleId, permission)
      ).to.be.revertedWith("Permission already exists");
    });

    it("Should remove permission from role", async function () {
      await accessControlManager.addPermission(roleId, permission);
      
      await expect(accessControlManager.removePermission(roleId, permission))
        .to.emit(accessControlManager, "PermissionRemoved")
        .withArgs(roleId, permission);
      
      const permissions = await accessControlManager.getRolePermissions(roleId);
      expect(permissions).to.not.include(permission);
    });
  });

  describe("User Role Assignment", function () {
    let roleId;

    beforeEach(async function () {
      const roleName = "Operator";
      roleId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(roleName));
      await accessControlManager.createRole(roleId, roleName);
    });

    it("Should grant role to user", async function () {
      await expect(accessControlManager.grantRole(roleId, user1.address))
        .to.emit(accessControlManager, "RoleGranted")
        .withArgs(roleId, user1.address, owner.address);
      
      expect(await accessControlManager.hasRole(roleId, user1.address)).to.be.true;
    });

    it("Should revoke role from user", async function () {
      await accessControlManager.grantRole(roleId, user1.address);
      
      await expect(accessControlManager.revokeRole(roleId, user1.address))
        .to.emit(accessControlManager, "RoleRevoked")
        .withArgs(roleId, user1.address, owner.address);
      
      expect(await accessControlManager.hasRole(roleId, user1.address)).to.be.false;
    });

    it("Should return all user roles", async function () {
      const role1Name = "Role1";
      const role1Id = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(role1Name));
      await accessControlManager.createRole(role1Id, role1Name);
      
      const role2Name = "Role2";
      const role2Id = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(role2Name));
      await accessControlManager.createRole(role2Id, role2Name);
      
      await accessControlManager.grantRole(role1Id, user1.address);
      await accessControlManager.grantRole(role2Id, user1.address);
      
      const userRoles = await accessControlManager.getUserRoles(user1.address);
      expect(userRoles).to.have.lengthOf(2);
      expect(userRoles).to.include(role1Id);
      expect(userRoles).to.include(role2Id);
    });
  });

  describe("Permission Checking", function () {
    let roleId, resource, action;

    beforeEach(async function () {
      const roleName = "Editor";
      roleId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(roleName));
      await accessControlManager.createRole(roleId, roleName);
      
      resource = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("document"));
      action = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("edit"));
      
      const permission = ethers.utils.keccak256(
        ethers.utils.concat([resource, action])
      );
      
      await accessControlManager.addPermission(roleId, permission);
      await accessControlManager.grantRole(roleId, user1.address);
    });

    it("Should correctly check user permissions", async function () {
      const hasPermission = await accessControlManager.checkPermission(
        user1.address,
        resource,
        action
      );
      
      expect(hasPermission).to.be.true;
    });

    it("Should return false for users without permission", async function () {
      const hasPermission = await accessControlManager.checkPermission(
        user2.address,
        resource,
        action
      );
      
      expect(hasPermission).to.be.false;
    });

    it("Should return false for inactive users", async function () {
      await accessControlManager.deactivateUser(user1.address);
      
      const hasPermission = await accessControlManager.checkPermission(
        user1.address,
        resource,
        action
      );
      
      expect(hasPermission).to.be.false;
    });
  });

  describe("User Management", function () {
    let roleId;

    beforeEach(async function () {
      const roleName = "TestRole";
      roleId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(roleName));
      await accessControlManager.createRole(roleId, roleName);
      await accessControlManager.grantRole(roleId, user1.address);
    });

    it("Should deactivate user", async function () {
      await expect(accessControlManager.deactivateUser(user1.address))
        .to.emit(accessControlManager, "UserDeactivated")
        .withArgs(user1.address, owner.address);
      
      const userInfo = await accessControlManager.getUserInfo(user1.address);
      expect(userInfo.isActive).to.be.false;
    });

    it("Should reactivate user", async function () {
      await accessControlManager.deactivateUser(user1.address);
      
      await expect(accessControlManager.reactivateUser(user1.address))
        .to.emit(accessControlManager, "UserReactivated")
        .withArgs(user1.address, owner.address);
      
      const userInfo = await accessControlManager.getUserInfo(user1.address);
      expect(userInfo.isActive).to.be.true;
    });

    it("Should get user information", async function () {
      const userInfo = await accessControlManager.getUserInfo(user1.address);
      
      expect(userInfo.isActive).to.be.true;
      expect(userInfo.roleCount).to.equal(1);
    });
  });

  describe("Emergency Controls", function () {
    it("Should pause and unpause contract", async function () {
      // Add second admin for multi-sig
      await accessControlManager.addAdmin(admin1.address);
      await accessControlManager.connect(admin1).addAdmin(admin1.address);
      
      // Pause requires multi-sig
      await accessControlManager.pause();
      await accessControlManager.connect(admin1).pause();
      
      const roleName = "TestRole";
      const roleId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(roleName));
      
      // Operations should fail when paused
      await expect(
        accessControlManager.createRole(roleId, roleName)
      ).to.be.revertedWith("Pausable: paused");
      
      // Unpause
      await accessControlManager.unpause();
      await accessControlManager.connect(admin1).unpause();
      
      // Operations should work again
      await expect(accessControlManager.createRole(roleId, roleName))
        .to.emit(accessControlManager, "RoleCreated");
    });
  });

  describe("Query Functions", function () {
    it("Should return all roles", async function () {
      const role1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Role1"));
      const role2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Role2"));
      
      await accessControlManager.createRole(role1, "Role1");
      await accessControlManager.createRole(role2, "Role2");
      
      const allRoles = await accessControlManager.getAllRoles();
      expect(allRoles).to.have.lengthOf(2);
    });

    it("Should return user count", async function () {
      const roleId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("TestRole"));
      await accessControlManager.createRole(roleId, "TestRole");
      
      await accessControlManager.grantRole(roleId, user1.address);
      await accessControlManager.grantRole(roleId, user2.address);
      
      expect(await accessControlManager.getUserCount()).to.equal(2);
    });

    it("Should get role information", async function () {
      const roleName = "InfoRole";
      const roleId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(roleName));
      
      await accessControlManager.createRole(roleId, roleName);
      
      const roleInfo = await accessControlManager.getRoleInfo(roleId);
      expect(roleInfo.name).to.equal(roleName);
      expect(roleInfo.createdBy).to.equal(owner.address);
      expect(roleInfo.permissionCount).to.equal(0);
    });
  });

  describe("Gas Usage", function () {
    it("Should report gas for role creation", async function () {
      const roleName = "GasTestRole";
      const roleId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(roleName));
      
      const tx = await accessControlManager.createRole(roleId, roleName);
      const receipt = await tx.wait();
      
      console.log(`Gas used for role creation: ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.lessThan(500000);
    });

    it("Should report gas for role grant", async function () {
      const roleName = "GasTestRole";
      const roleId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(roleName));
      await accessControlManager.createRole(roleId, roleName);
      
      const tx = await accessControlManager.grantRole(roleId, user1.address);
      const receipt = await tx.wait();
      
      console.log(`Gas used for role grant: ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.lessThan(200000);
    });
  });
});
