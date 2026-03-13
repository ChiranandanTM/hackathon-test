import os
import json
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
from typing import Optional, Dict, Any, List
from bson import ObjectId

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/agentguard")

# Try MongoDB first, fall back to file-based storage
try:
    from pymongo import MongoClient
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    client.admin.command('ping')
    db = client["agentguard"]
    transactions_collection = db["transactions"]
    STORAGE_MODE = "mongodb"
    print("✓ MongoDB connected successfully")
except Exception as e:
    print(f"⚠ MongoDB not available: {e}")
    print("  Using file-based persistence instead")
    STORAGE_MODE = "filesystem"
    transactions_collection = None


class QueryHelper:
    """Helper class to support method chaining for find/sort/limit"""
    def __init__(self, data: List[Dict]):
        self.data = data
        self._sort_field = None
        self._sort_direction = 1
        self._limit_count = None
    
    def sort(self, field_or_list, direction=1):
        """Sort results by field"""
        if isinstance(field_or_list, list):
            # MongoDB style: [("field", -1)]
            self._sort_field = field_or_list[0][0]
            self._sort_direction = field_or_list[0][1]
        else:
            # String field
            self._sort_field = field_or_list
            self._sort_direction = direction
        return self
    
    def limit(self, count):
        """Limit number of results"""
        self._limit_count = count
        return self
    
    def __iter__(self):
        """Make iterable"""
        results = list(self.data)
        
        if self._sort_field:
            reverse = self._sort_direction == -1
            results.sort(key=lambda x: x.get(self._sort_field, ""), reverse=reverse)
        
        if self._limit_count:
            results = results[:self._limit_count]
        
        return iter(results)


class FileBasedCollection:
    """File-based replacement for MongoDB collection using JSON storage"""
    
    def __init__(self, storage_dir: str = "data"):
        self.storage_dir = Path(storage_dir)
        try:
            self.storage_dir.mkdir(parents=True, exist_ok=True)
            print(f"✓ Storage directory: {self.storage_dir.absolute()}")
        except Exception as e:
            print(f"Warning: Could not create storage directory: {e}")
        
        self.collection_file = self.storage_dir / "transactions.json"
        self._load_data()
    
    def _load_data(self):
        """Load all transactions from file"""
        if self.collection_file.exists():
            try:
                with open(self.collection_file, 'r') as f:
                    self._data = json.load(f)
                print(f"✓ Loaded {len(self._data)} existing transactions")
            except Exception as e:
                print(f"Warning: Could not load transactions: {e}")
                self._data = []
        else:
            print(f"✓ Starting with new transaction database")
            self._data = []
    
    def _save_data(self):
        """Save all transactions to file"""
        try:
            # Ensure directory exists
            self.storage_dir.mkdir(parents=True, exist_ok=True)
            
            with open(self.collection_file, 'w') as f:
                json.dump(self._data, f, indent=2, default=str)
            
            # Also keep a backup
            backup_file = self.storage_dir / f"transactions_backup_{len(self._data)}.json"
            if len(self._data) % 10 == 0:  # Every 10 transactions
                with open(backup_file, 'w') as f:
                    json.dump(self._data, f, indent=2, default=str)
        except Exception as e:
            print(f"⚠️  Error saving transactions: {e}")
    
    def insert_one(self, document: Dict[str, Any]):
        """Insert a single document"""
        doc = dict(document)
        doc['_id'] = str(ObjectId())
        self._data.append(doc)
        self._save_data()
        
        # Return object with inserted_id property like pymongo
        class InsertResult:
            def __init__(self, doc_id):
                self.inserted_id = doc_id
        
        result = InsertResult(doc['_id'])
        # Print confirmation
        print(f"  ✓ Transaction saved: {doc['_id']} (Total: {len(self._data)})")
        return result
    
    def find_one(self, query: Dict[str, Any]) -> Optional[Dict]:
        """Find a single document"""
        for doc in self._data:
            if self._matches_query(doc, query):
                return doc
        return None
    
    def find(self, query: Dict[str, Any] = None):
        """Find multiple documents - returns QueryHelper for chaining"""
        if query is None:
            query = {}
        
        results = [doc for doc in self._data if self._matches_query(doc, query)]
        return QueryHelper(results)
    
    def update_one(self, query: Dict[str, Any], update: Dict[str, Any]):
        """Update a single document"""
        for i, doc in enumerate(self._data):
            if self._matches_query(doc, query):
                if "$set" in update:
                    doc.update(update["$set"])
                else:
                    doc.update(update)
                self._save_data()
                
                # Return object with matched_count like pymongo
                class UpdateResult:
                    def __init__(self):
                        self.matched_count = 1
                
                return UpdateResult()
        
        class UpdateResult:
            def __init__(self):
                self.matched_count = 0
        
        return UpdateResult()
    
    def _matches_query(self, doc: Dict, query: Dict) -> bool:
        """Check if document matches query"""
        for key, value in query.items():
            if key.startswith("_"):
                # Handle _id specially - convert to string for comparison
                doc_val = str(doc.get(key))
                query_val = str(value)
                if doc_val != query_val:
                    return False
            else:
                if doc.get(key) != value:
                    return False
        return True
    
    def create_index(self, index_spec: List):
        """Dummy method for compatibility"""
        pass


# Use file-based collection if MongoDB is not available
if STORAGE_MODE == "filesystem":
    storage_dir = os.getenv("DATA_STORAGE_DIR", "data")
    transactions_collection = FileBasedCollection(storage_dir=storage_dir)


def initialize_database():
    """Initialize database with required indexes"""
    if STORAGE_MODE == "mongodb":
        try:
            # Index for faster audit log queries
            transactions_collection.create_index([("timestamp", -1)])
            transactions_collection.create_index([("status", 1)])
            transactions_collection.create_index([("risk_report.risk_level", 1)])
            print("✓ Database indexes created")
        except Exception as e:
            print(f"⚠ Could not create indexes: {e}")
    else:
        print("✓ File-based storage initialized")
