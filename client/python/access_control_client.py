"""
Blockchain Access Control Client Library
Python client for interacting with the decentralized access control system
"""

from web3 import Web3
from web3.middleware import geth_poa_middleware
from eth_account import Account
import json
import os
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import hashlib

class AccessControlClient:
    """Client for interacting with AccessControlManager contract"""
    
    def __init__(self, provider_url: str, contract_address: str, private_key: Optional[str] = None):
        """
        Initialize the client
        
        Args:
            provider_url: Web3 provider URL (e.g., Infura endpoint)
            contract_address: Deployed AccessControlManager contract address
            private_key: Private key for signing transactions (optional for read-only)
        """
        self.w3 = Web3(Web3.HTTPProvider(provider_url))
        
        # Add PoA middleware for testnets like Sepolia
        self.w3.middleware_onion.inject(geth_poa_middleware, layer=0)
        
        if not self.w3.isConnected():
            raise ConnectionError("Failed to connect to Web3 provider")
        
        self.contract_address = Web3.toChecksumAddress(contract_address)
        
        # Load contract ABI
        with open('abis/AccessControlManager.json', 'r') as f:
            contract_abi = json.load(f)
        
        self.contract = self.w3.eth.contract(
            address=self.contract_address,
            abi=contract_abi['abi']
        )
        
        if private_key:
            self.account = Account.from_key(private_key)
            self.address = self.account.address
        else:
            self.account = None
            self.address = None
    
    def _send_transaction(self, function, *args, **kwargs):
        """Internal method to send transactions"""
        if not self.account:
            raise ValueError("Private key required for transactions")
        
        # Build transaction
        tx = function(*args, **kwargs).buildTransaction({
            'from': self.address,
            'nonce': self.w3.eth.getTransactionCount(self.address),
            'gas': 500000,
            'gasPrice': self.w3.eth.gas_price
        })
        
        # Sign transaction
        signed_tx = self.w3.eth.account.sign_transaction(tx, self.account.key)
        
        # Send transaction
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        
        # Wait for receipt
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        
        return receipt
    
    def create_role(self, role_name: str) -> Tuple[str, str]:
        """
        Create a new role
        
        Args:
            role_name: Name of the role
            
        Returns:
            Tuple of (role_id, transaction_hash)
        """
        role_id = Web3.keccak(text=role_name)
        receipt = self._send_transaction(
            self.contract.functions.createRole,
            role_id,
            role_name
        )
        return (role_id.hex(), receipt['transactionHash'].hex())
    
    def grant_role(self, role_name: str, user_address: str) -> str:
        """
        Grant a role to a user
        
        Args:
            role_name: Name of the role
            user_address: Ethereum address of the user
            
        Returns:
            Transaction hash
        """
        role_id = Web3.keccak(text=role_name)
        user_address = Web3.toChecksumAddress(user_address)
        receipt = self._send_transaction(
            self.contract.functions.grantRole,
            role_id,
            user_address
        )
        return receipt['transactionHash'].hex()
    
    def revoke_role(self, role_name: str, user_address: str) -> str:
        """
        Revoke a role from a user
        
        Args:
            role_name: Name of the role
            user_address: Ethereum address of the user
            
        Returns:
            Transaction hash
        """
        role_id = Web3.keccak(text=role_name)
        user_address = Web3.toChecksumAddress(user_address)
        receipt = self._send_transaction(
            self.contract.functions.revokeRole,
            role_id,
            user_address
        )
        return receipt['transactionHash'].hex()
    
    def add_permission(self, role_name: str, resource: str, action: str) -> str:
        """
        Add a permission to a role
        
        Args:
            role_name: Name of the role
            resource: Resource identifier
            action: Action identifier
            
        Returns:
            Transaction hash
        """
        role_id = Web3.keccak(text=role_name)
        permission = Web3.keccak(text=f"{resource}:{action}")
        receipt = self._send_transaction(
            self.contract.functions.addPermission,
            role_id,
            permission
        )
        return receipt['transactionHash'].hex()
    
    def has_role(self, role_name: str, user_address: str) -> bool:
        """
        Check if a user has a specific role
        
        Args:
            role_name: Name of the role
            user_address: Ethereum address of the user
            
        Returns:
            True if user has the role, False otherwise
        """
        role_id = Web3.keccak(text=role_name)
        user_address = Web3.toChecksumAddress(user_address)
        return self.contract.functions.hasRole(role_id, user_address).call()
    
    def check_permission(self, user_address: str, resource: str, action: str) -> bool:
        """
        Check if a user has permission to perform an action
        
        Args:
            user_address: Ethereum address of the user
            resource: Resource identifier
            action: Action identifier
            
        Returns:
            True if user has permission, False otherwise
        """
        user_address = Web3.toChecksumAddress(user_address)
        resource_bytes = Web3.keccak(text=resource)
        action_bytes = Web3.keccak(text=action)
        return self.contract.functions.checkPermission(
            user_address,
            resource_bytes,
            action_bytes
        ).call()
    
    def get_user_roles(self, user_address: str) -> List[str]:
        """
        Get all roles assigned to a user
        
        Args:
            user_address: Ethereum address of the user
            
        Returns:
            List of role IDs (hex strings)
        """
        user_address = Web3.toChecksumAddress(user_address)
        roles = self.contract.functions.getUserRoles(user_address).call()
        return [r.hex() for r in roles]
    
    def get_role_permissions(self, role_name: str) -> List[str]:
        """
        Get all permissions for a role
        
        Args:
            role_name: Name of the role
            
        Returns:
            List of permission IDs (hex strings)
        """
        role_id = Web3.keccak(text=role_name)
        permissions = self.contract.functions.getRolePermissions(role_id).call()
        return [p.hex() for p in permissions]
    
    def get_all_roles(self) -> List[str]:
        """
        Get all roles in the system
        
        Returns:
            List of role IDs (hex strings)
        """
        roles = self.contract.functions.getAllRoles().call()
        return [r.hex() for r in roles]
    
    def pause_contract(self) -> str:
        """
        Pause the contract (emergency only, requires admin)
        
        Returns:
            Transaction hash
        """
        receipt = self._send_transaction(self.contract.functions.pause)
        return receipt['transactionHash'].hex()
    
    def unpause_contract(self) -> str:
        """
        Unpause the contract (requires admin)
        
        Returns:
            Transaction hash
        """
        receipt = self._send_transaction(self.contract.functions.unpause)
        return receipt['transactionHash'].hex()


class PolicyRegistryClient:
    """Client for interacting with PolicyRegistry contract"""
    
    def __init__(self, provider_url: str, contract_address: str, private_key: Optional[str] = None):
        """Initialize the policy registry client"""
        self.w3 = Web3(Web3.HTTPProvider(provider_url))
        self.w3.middleware_onion.inject(geth_poa_middleware, layer=0)
        
        if not self.w3.isConnected():
            raise ConnectionError("Failed to connect to Web3 provider")
        
        self.contract_address = Web3.toChecksumAddress(contract_address)
        
        with open('abis/PolicyRegistry.json', 'r') as f:
            contract_abi = json.load(f)
        
        self.contract = self.w3.eth.contract(
            address=self.contract_address,
            abi=contract_abi['abi']
        )
        
        if private_key:
            self.account = Account.from_key(private_key)
            self.address = self.account.address
        else:
            self.account = None
            self.address = None
    
    def _send_transaction(self, function, *args, **kwargs):
        """Internal method to send transactions"""
        if not self.account:
            raise ValueError("Private key required for transactions")
        
        tx = function(*args, **kwargs).buildTransaction({
            'from': self.address,
            'nonce': self.w3.eth.getTransactionCount(self.address),
            'gas': 500000,
            'gasPrice': self.w3.eth.gas_price
        })
        
        signed_tx = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        
        return receipt
    
    def create_policy(
        self, 
        policy_name: str, 
        description: str, 
        ipfs_hash: str
    ) -> Tuple[str, str]:
        """
        Create a new policy
        
        Args:
            policy_name: Name of the policy
            description: Policy description
            ipfs_hash: IPFS hash of the detailed policy document
            
        Returns:
            Tuple of (policy_id, transaction_hash)
        """
        policy_id = Web3.keccak(text=policy_name)
        ipfs_hash_bytes = Web3.toBytes(hexstr=ipfs_hash)
        
        receipt = self._send_transaction(
            self.contract.functions.createPolicy,
            policy_id,
            policy_name,
            description,
            ipfs_hash_bytes
        )
        
        return (policy_id.hex(), receipt['transactionHash'].hex())
    
    def update_policy(
        self, 
        policy_name: str, 
        new_ipfs_hash: str, 
        change_description: str
    ) -> str:
        """
        Update an existing policy
        
        Args:
            policy_name: Name of the policy
            new_ipfs_hash: New IPFS hash
            change_description: Description of changes
            
        Returns:
            Transaction hash
        """
        policy_id = Web3.keccak(text=policy_name)
        ipfs_hash_bytes = Web3.toBytes(hexstr=new_ipfs_hash)
        
        receipt = self._send_transaction(
            self.contract.functions.updatePolicy,
            policy_id,
            ipfs_hash_bytes,
            change_description
        )
        
        return receipt['transactionHash'].hex()
    
    def get_policy(self, policy_name: str) -> Dict:
        """
        Get policy information
        
        Args:
            policy_name: Name of the policy
            
        Returns:
            Dictionary with policy information
        """
        policy_id = Web3.keccak(text=policy_name)
        result = self.contract.functions.getPolicy(policy_id).call()
        
        return {
            'name': result[0],
            'description': result[1],
            'ipfs_hash': result[2].hex(),
            'version': result[3],
            'created_at': datetime.fromtimestamp(result[4]),
            'updated_at': datetime.fromtimestamp(result[5]),
            'created_by': result[6],
            'last_updated_by': result[7],
            'is_active': result[8]
        }
    
    def anchor_log_batch(self, batch_hash: str, log_count: int) -> str:
        """
        Anchor a batch of logs on the blockchain
        
        Args:
            batch_hash: IPFS hash of the log batch
            log_count: Number of logs in the batch
            
        Returns:
            Transaction hash
        """
        batch_hash_bytes = Web3.toBytes(hexstr=batch_hash)
        
        receipt = self._send_transaction(
            self.contract.functions.anchorLogBatch,
            batch_hash_bytes,
            log_count
        )
        
        return receipt['transactionHash'].hex()
    
    def verify_log_batch(self, batch_id: int, expected_hash: str) -> bool:
        """
        Verify integrity of a log batch
        
        Args:
            batch_id: ID of the batch
            expected_hash: Expected IPFS hash
            
        Returns:
            True if batch is valid, False otherwise
        """
        expected_hash_bytes = Web3.toBytes(hexstr=expected_hash)
        return self.contract.functions.verifyLogBatch(
            batch_id,
            expected_hash_bytes
        ).call()


# Example usage
if __name__ == "__main__":
    # Configuration
    PROVIDER_URL = "https://sepolia.infura.io/v3/YOUR_INFURA_KEY"
    ACCESS_CONTROL_ADDRESS = "0x..."  # Your deployed contract address
    PRIVATE_KEY = "0x..."  # Your private key
    
    # Initialize client
    client = AccessControlClient(PROVIDER_URL, ACCESS_CONTROL_ADDRESS, PRIVATE_KEY)
    
    # Create a role
    role_id, tx_hash = client.create_role("Administrator")
    print(f"Created role: {role_id}")
    print(f"Transaction: {tx_hash}")
    
    # Grant role to user
    user_address = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
    tx_hash = client.grant_role("Administrator", user_address)
    print(f"Granted role to {user_address}")
    print(f"Transaction: {tx_hash}")
    
    # Check if user has role
    has_role = client.has_role("Administrator", user_address)
    print(f"User has Administrator role: {has_role}")
    
    # Add permission
    tx_hash = client.add_permission("Administrator", "database", "write")
    print(f"Added permission to role")
    print(f"Transaction: {tx_hash}")
    
    # Check permission
    can_write = client.check_permission(user_address, "database", "write")
    print(f"User can write to database: {can_write}")
