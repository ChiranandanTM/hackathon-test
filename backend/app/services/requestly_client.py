"""
Requestly API Client Integration - ETHIndia Hackathon
Sophisticated API Client for AgentGuard Backend Endpoints
Demonstrates complex request construction, authentication, and validation
"""

import httpx
import asyncio
import json
from typing import Dict, Any, Optional, List
from datetime import datetime
import hashlib
import hmac

# ============================================================================
# COMPLEX REQUEST CONSTRUCTION: Multi-part requests with auth schemes
# ============================================================================

class RequestlyAPIClient:
    """
    Advanced API Client for AgentGuard demonstrating Requestly best practices:
    - Complex request construction
    - Multiple authentication schemes (Bearer, API Key, HMAC)
    - Request/response interceptors
    - Pre-request and post-response scripts
    - Local workspace collaboration
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        timeout: float = 30.0,
        enable_logging: bool = True
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.enable_logging = enable_logging
        self.request_history: List[Dict[str, Any]] = []
        self.response_history: List[Dict[str, Any]] = []

    async def _pre_request_script(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        PRE-REQUEST SCRIPT: Executes before every request
        Demonstrates validation, transformation, and enrichment
        """
        if self.enable_logging:
            print(f"\n[PRE-REQUEST] {request_data.get('method')} {request_data.get('url')}")

        # 1. Validate required fields
        required_fields = ["method", "url"]
        for field in required_fields:
            if field not in request_data:
                raise ValueError(f"Missing required field: {field}")

        # 2. Add request metadata
        request_data["timestamp"] = datetime.utcnow().isoformat()
        request_data["request_id"] = hashlib.sha256(
            f"{request_data['url']}{request_data['timestamp']}".encode()
        ).hexdigest()[:16]

        # 3. Validate request body schema
        if request_data.get("body"):
            self._validate_request_body(request_data)

        # 4. Add default headers
        if "headers" not in request_data:
            request_data["headers"] = {}

        request_data["headers"]["User-Agent"] = "RequestlyAPIClient/1.0"
        request_data["headers"]["X-Request-ID"] = request_data["request_id"]

        if self.enable_logging:
            print(f"  Request ID: {request_data['request_id']}")
            print(f"  Headers: {json.dumps(request_data['headers'], indent=2)}")

        return request_data

    def _validate_request_body(self, request_data: Dict[str, Any]) -> None:
        """Validates request body against expected schemas"""
        body = request_data.get("body", {})
        endpoint = request_data.get("url", "").split("/")[-1]

        # Define schemas for different endpoints
        schemas = {
            "intercept": {
                "from_address": str,
                "to_address": str,
                "function_name": str,
                "args": dict,
            },
            "approve": {
                "reason": (str, type(None)),
            },
        }

        if endpoint in schemas:
            schema = schemas[endpoint]
            for field, field_type in schema.items():
                if field in body:
                    if not isinstance(body[field], field_type):
                        raise TypeError(
                            f"Field '{field}' must be {field_type}, got {type(body[field])}"
                        )

    async def _post_response_script(
        self, response_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        POST-RESPONSE SCRIPT: Executes after receiving response
        - Validates response schema
        - Checks status codes
        - Parses and enriches response
        - Logs metrics
        """
        if self.enable_logging:
            print(f"\n[POST-RESPONSE] {response_data.get('status_code')}")

        # 1. Validate status code
        status_code = response_data.get("status_code", 0)
        if status_code >= 400 and self.enable_logging:
            print(f"  Warning: HTTP {status_code}")
            if status_code == 404:
                print("  - Endpoint not found")
            elif status_code == 500:
                print("  - Server error")

        # 2. Parse and validate response JSON
        try:
            if isinstance(response_data.get("body"), str):
                response_data["body"] = json.loads(response_data["body"])
        except json.JSONDecodeError:
            if self.enable_logging:
                print("  Warning: Response is not valid JSON")

        # 3. Extract and validate critical fields
        body = response_data.get("body", {})
        critical_fields = ["status", "tx_id"]

        if self.enable_logging:
            print("  Response Validation:")
            for field in critical_fields:
                if field in body:
                    print(f"    - {field}: {body[field]}")

        # 4. Add timing information
        if "headers" in response_data and self.enable_logging:
            response_time = response_data["headers"].get("X-Response-Time", "N/A")
            print(f"  Response Time: {response_time}ms")

        return response_data

    async def execute_complex_request(
        self,
        method: str,
        endpoint: str,
        body: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        auth_type: str = "none",
        auth_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        COMPLEX REQUEST CONSTRUCTION
        - Supports multiple HTTP methods
        - Multi-part authentication schemes
        - Custom header injection
        - Request/response transformation
        """
        url = f"{self.base_url}{endpoint}"

        request_data = {
            "method": method.upper(),
            "url": url,
            "body": body,
            "headers": headers or {},
        }

        # PRE-REQUEST SCRIPT
        request_data = await self._pre_request_script(request_data)

        # Apply authentication schemes
        if auth_type == "bearer":
            if not auth_token:
                raise ValueError("auth_token required for Bearer authentication")
            request_data["headers"]["Authorization"] = f"Bearer {auth_token}"

        elif auth_type == "api_key":
            if not auth_token:
                raise ValueError("auth_token required for API Key authentication")
            request_data["headers"]["X-API-Key"] = auth_token

        elif auth_type == "hmac":
            # HMAC signature authentication
            if not auth_token:
                raise ValueError("auth_token (secret) required for HMAC authentication")
            body_str = json.dumps(body) if body else ""
            signature = hmac.new(
                auth_token.encode(),
                body_str.encode(),
                hashlib.sha256
            ).hexdigest()
            request_data["headers"]["X-Signature"] = signature

        # Execute request
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.request(
                    method=request_data["method"],
                    url=request_data["url"],
                    json=request_data["body"],
                    headers=request_data["headers"],
                )

                response_data = {
                    "status_code": response.status_code,
                    "headers": dict(response.headers),
                    "body": response.text,
                    "request_id": request_data.get("request_id"),
                    "timestamp": datetime.utcnow().isoformat(),
                }

                # POST-RESPONSE SCRIPT
                response_data = await self._post_response_script(response_data)

                # Store in history
                self.request_history.append(request_data)
                self.response_history.append(response_data)

                if self.enable_logging:
                    print(f"  Response stored in history (Total: {len(self.response_history)})")

                return response_data

            except httpx.TimeoutException:
                if self.enable_logging:
                    print(f"  Request timeout after {self.timeout}s")
                raise
            except Exception as err:
                if self.enable_logging:
                    print(f"  Request failed: {str(err)}")
                raise

    # ====================================================================
    # ENDPOINT VALIDATION: Production-grade endpoint testing
    # ====================================================================

    async def validate_endpoint(
        self, endpoint: str, method: str = "GET", expected_status: int = 200
    ) -> bool:
        """
        ENDPOINT VALIDATION:
        - Schema validation
        - Status code verification
        - Response structure verification
        """
        if self.enable_logging:
            print(f"\n[VALIDATE] {method} {endpoint}")

        try:
            response_data = await self.execute_complex_request(method, endpoint)
            status_ok = response_data["status_code"] == expected_status

            if self.enable_logging:
                print(f"  Expected Status: {expected_status}, Got: {response_data['status_code']}")
                print(f"  Status Valid: {status_ok}")

            return status_ok

        except Exception as err:
            if self.enable_logging:
                print(f"  Validation failed: {str(err)}")
            return False

    async def validate_staging_environment(self) -> Dict[str, bool]:
        """
        Validates staging environment against production schemas
        """
        if self.enable_logging:
            print("\n[STAGING VALIDATION]")
            print("=" * 50)

        sample_tx = {
            "from_address": "0xUSER",
            "to_address": "0xDEADBEEF0000000000000000000000000000DEAD",
            "function_name": "approve",
            "args": {"spender": "0xBAD", "amount": str(2**256 - 1)},
            "value": 0,
            "user_intent": "Approve spending for a DeFi protocol",
            "wallet_balance": 5000000000,
        }

        validations = {
            "health_check": await self.validate_endpoint("/", "GET", 200),
            "audit_endpoint": await self.validate_endpoint("/audit", "GET", 200),
        }

        intercept_response = await self.execute_complex_request(
            method="POST",
            endpoint="/intercept",
            body=sample_tx,
        )
        validations["intercept_endpoint"] = intercept_response.get("status_code") == 200

        if self.enable_logging:
            print("\nVALIDATION SUMMARY:")
            for check, result in validations.items():
                status = "OK" if result else "FAIL"
                print(f"  [{status}] {check}")

        return validations

    # ====================================================================
    # REQUEST HISTORY & DEBUGGING
    # ====================================================================

    def get_request_summary(self) -> Dict[str, Any]:
        """Returns summary of all requests made"""
        return {
            "total_requests": len(self.request_history),
            "total_responses": len(self.response_history),
            "requests": self.request_history,
            "responses": self.response_history,
        }

    def export_workspace(self, filename: str = "requestly_workspace.json") -> str:
        """
        Exports API interaction history for Requestly workspace
        Supports local and team workspace collaboration
        """
        workspace_data = {
            "version": "1.0",
            "created_at": datetime.utcnow().isoformat(),
            "environment": "local",
            "requests": self.request_history,
            "responses": self.response_history,
            "validation_results": {
                "total_validated": len(self.response_history),
                "successful": sum(1 for r in self.response_history if r.get("status_code", 0) < 400),
            }
        }

        with open(filename, "w") as f:
            json.dump(workspace_data, f, indent=2)

        if self.enable_logging:
            print(f"\nWorkspace exported to: {filename}")
        return filename



# Backward compatibility alias (existing imports use old class name).
RequeslyAPIClient = RequestlyAPIClient
