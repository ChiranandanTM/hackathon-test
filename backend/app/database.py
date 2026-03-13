import os
import json
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
from typing import Optional, Dict, Any, List
from bson import ObjectId

load_dotenv()

# Firebase configuration from environment or defaults
FIREBASE_CONFIG = {
    "type": "service_account",
    "project_id": "hackathon-hack-1",
    "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID", ""),
    "private_key": os.getenv("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n"),
    "client_email": os.getenv("FIREBASE_CLIENT_EMAIL", ""),
    "client_id": os.getenv("FIREBASE_CLIENT_ID", ""),
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
}

# Try Firebase first, fall back to file-based storage
STORAGE_MODE = "firebase"
firebase_db = None  # Renamed from 'db' to avoid confusion
transactions_collection = None

def _connect_firebase():
    """Attempt to connect to Firebase Firestore"""
    global firebase_db, transactions_collection, STORAGE_MODE
    
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        print(f"  >> Connecting to Firebase Firestore...")
        
        # Check if app is already initialized
        try:
            firebase_app = firebase_admin.get_app()
            print(f"  >> Using existing Firebase app")
        except ValueError:
            # App not initialized yet
            print(f"  >> Initializing new Firebase app...")
            cred = credentials.Certificate(FIREBASE_CONFIG)
            firebase_app = firebase_admin.initialize_app(cred)
        
        # Get Firestore database client
        firebase_db = firestore.client()
        print(f"  >> Firebase client obtained: {type(firebase_db)}")
        
        # Verify connection with a simple read
        print(f"  >> Testing Firestore connectivity...")
        list(firebase_db.collection("transactions").limit(1).stream())
        
        STORAGE_MODE = "firebase"
        print(">>> SUCCESS: Firebase Firestore connected and ready!")
        return True
            
    except ImportError as e:
        print(f">>> ERROR: firebase-admin not installed - {str(e)[:100]}")
        STORAGE_MODE = "filesystem"
        return False
    except Exception as e:
        error_msg = str(e)
        print(f">>> ERROR: Firebase connection failed: {error_msg[:120]}")
        STORAGE_MODE = "filesystem"
        return False


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
            self._sort_field = field_or_list[0][0]
            self._sort_direction = field_or_list[0][1]
        else:
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


class FirebaseCollection:
    """Firebase Firestore collection wrapper"""
    
    def __init__(self, collection_name: str = "intercepts", db_client=None):
        self.collection_name = collection_name
        self.db = db_client
        self.instance_id = id(self)  # Add instance ID for debugging
        if not self.db:
            raise ValueError(f"Firestore client required but got None")
        print(f">>> FirebaseCollection created: instance_id={self.instance_id}, collection={collection_name}")
    
    def insert_one(self, document: Dict[str, Any]):
        """Insert a document into Firebase Firestore"""
        # Prepare document
        doc = dict(document)
        if '_id' not in doc:
            doc['_id'] = str(ObjectId())
        if 'timestamp' not in doc:
            doc['timestamp'] = datetime.now().isoformat()
        
        doc_id = doc['_id']

        # Write to Firestore with explicit error propagation.
        try:
            self.db.collection(self.collection_name).document(doc_id).set(doc)
        except Exception as e:
            raise RuntimeError(f"Failed to write to Firebase: {str(e)}")
        
        # Return result
        class InsertResult:
            def __init__(self, doc_id):
                self.inserted_id = doc_id
        
        return InsertResult(doc_id)
    
    def find_one(self, query: Dict[str, Any]) -> Optional[Dict]:
        """Find a single document"""
        try:
            if "_id" in query:
                doc_id = str(query.get("_id"))
                snap = self.db.collection(self.collection_name).document(doc_id).get()
                if not snap.exists:
                    return None
                data = snap.to_dict() or {}
                data["_id"] = snap.id
                return data

            docs = self.db.collection(self.collection_name)
            
            # Build query
            for key, value in query.items():
                docs = docs.where(key, "==", value)
            
            results = docs.limit(1).stream()
            
            for doc in results:
                data = doc.to_dict() or {}
                data["_id"] = doc.id
                return data
            
            return None
            
        except Exception as e:
            print(f"  ! Error querying Firebase: {str(e)[:80]}")
            return None
    
    def find(self, query: Dict[str, Any] = None):
        """Find multiple documents"""
        try:
            if query is None:
                query = {}
            
            docs = self.db.collection(self.collection_name)
            
            # Build query
            for key, value in query.items():
                docs = docs.where(key, "==", value)
            
            results = []
            for doc in docs.stream():
                data = doc.to_dict() or {}
                data["_id"] = doc.id
                results.append(data)
            
            return QueryHelper(results)
            
        except Exception as e:
            print(f"  ! Error querying Firebase: {str(e)[:80]}")
            return QueryHelper([])
    
    def update_one(self, query: Dict[str, Any], update: Dict[str, Any]):
        """Update a single document"""
        try:
            if "_id" not in query:
                class UpdateResult:
                    def __init__(self):
                        self.matched_count = 0
                return UpdateResult()

            doc_id = str(query.get("_id"))
            doc_ref = self.db.collection(self.collection_name).document(doc_id)
            if not doc_ref.get().exists:
                class UpdateResult:
                    def __init__(self):
                        self.matched_count = 0
                return UpdateResult()
            
            # Prepare update data
            update_data = update.get("$set", update)
            update_data['updated_at'] = datetime.now().isoformat()
            
            # Update in Firestore
            doc_ref.update(update_data)
            
            class UpdateResult:
                def __init__(self):
                    self.matched_count = 1
            
            return UpdateResult()
            
        except Exception as e:
            print(f"  ! Error updating Firebase: {str(e)[:80]}")
            class UpdateResult:
                def __init__(self):
                    self.matched_count = 0
            return UpdateResult()
    
    def create_index(self, index_spec: List):
        """Dummy method for compatibility (Firebase auto-indexes)"""
        pass


class FileBasedCollection:
    """File-based fallback collection"""
    
    def __init__(self, storage_dir: str = "data"):
        self.storage_dir = Path(storage_dir)
        try:
            self.storage_dir.mkdir(parents=True, exist_ok=True)
            print(f"+ Storage directory: {self.storage_dir.absolute()}")
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
                print(f"+ Loaded {len(self._data)} existing transactions from file")
            except Exception as e:
                print(f"Warning: Could not load transactions: {e}")
                self._data = []
        else:
            print(f"+ Starting with new transaction database")
            self._data = []
    
    def _save_data(self):
        """Save all transactions to file"""
        try:
            self.storage_dir.mkdir(parents=True, exist_ok=True)
            with open(self.collection_file, 'w') as f:
                json.dump(self._data, f, indent=2, default=str)
        except Exception as e:
            print(f"! Error saving to file: {e}")
    
    def insert_one(self, document: Dict[str, Any]):
        """Insert a single document"""
        doc = dict(document)
        if '_id' not in doc:
            doc['_id'] = str(ObjectId())
        
        self._data.append(doc)
        self._save_data()
        
        print(f"  + Saved to file: {doc['_id']} (Total: {len(self._data)})")
        
        class InsertResult:
            def __init__(self, doc_id):
                self.inserted_id = doc_id
        
        return InsertResult(doc['_id'])
    
    def find_one(self, query: Dict[str, Any]) -> Optional[Dict]:
        """Find a single document"""
        for doc in self._data:
            if self._matches_query(doc, query):
                return doc
        return None
    
    def find(self, query: Dict[str, Any] = None):
        """Find multiple documents"""
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


# Initialize storage backend
print("\n=== DATABASE INITIALIZATION ===")
firebase_connected = _connect_firebase()

if firebase_connected and firebase_db is not None:
    print(">> Creating Firebase collection wrapper...")
    transactions_collection = FirebaseCollection("intercepts", db_client=firebase_db)
    print(f">>> Database mode: FIREBASE")
else:
    raise RuntimeError("Firestore connection failed. Firebase is required for transaction history.")

print(f">>> Active storage mode: {STORAGE_MODE.upper()}")
print("=== INITIALIZATION COMPLETE ===\n")


def initialize_database():
    """Initialize database"""
    try:
        if STORAGE_MODE == "firebase":
            print("+ Firebase Firestore initialized")
        else:
            print("+ File-based storage initialized (Firebase unavailable)")
    except Exception as e:
        print(f"! Could not initialize database: {e}")
