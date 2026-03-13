import os
import json
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

FALLBACK_RESPONSE = {
    "intent_summary": "Unable to analyze transaction at this time.",
    "risk_explanation": "The AI analysis service is currently unavailable. Please review the risk flags manually.",
    "safe_action": "reject",
    "safe_params": {},
}


def analyze_transaction(tx: dict, risk_report: dict, user_intent: str) -> dict:
    # FIXED: Comprehensive error handling with fallback at every step
    try:
        if not ANTHROPIC_API_KEY:
            return {
                **FALLBACK_RESPONSE,
                "intent_summary": f"User intent: {user_intent or 'Unknown'}. AI analysis unavailable (no API key).",
            }

        tx_from = tx.get('from_address', 'unknown') if tx else 'unknown'
        tx_to = tx.get('to_address', 'unknown') if tx else 'unknown'
        tx_func = tx.get('function_name', 'unknown') if tx else 'unknown'
        tx_args = tx.get('args', {}) if tx else {}
        tx_value = tx.get('value', 0) if tx else 0

        prompt = f"""You are a blockchain security analyst. Analyze this transaction and explain the risks in simple English.

Transaction:
- From: {tx_from}
- To: {tx_to}
- Function: {tx_func}
- Arguments: {json.dumps(tx_args)}
- Value: {tx_value}

Risk Report:
- Risk Level: {risk_report.get('risk_level', 'unknown') if risk_report else 'unknown'}
- Flags: {json.dumps(risk_report.get('flags', []) if risk_report else [])}

User Intent: {user_intent or 'Unknown'}

Respond with a JSON object (no markdown, just raw JSON):
{{
  "intent_summary": "Brief summary of what the user is trying to do",
  "risk_explanation": "Simple English explanation of the risks for non-technical users",
  "safe_action": "approve or reject or modify",
  "safe_params": {{}}
}}"""

        try:
            import anthropic
        except ImportError:
            return {
                **FALLBACK_RESPONSE,
                "risk_explanation": "AI analysis library not available. Please review risk flags manually.",
            }

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            message = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )

            if not message.content or len(message.content) == 0:
                return FALLBACK_RESPONSE

            response_text = message.content[0].text.strip()

            # Try to parse JSON from the response
            try:
                result = json.loads(response_text)
            except json.JSONDecodeError:
                # Try extracting JSON from the response
                start = response_text.find("{")
                end = response_text.rfind("}") + 1
                if start != -1 and end > start:
                    try:
                        result = json.loads(response_text[start:end])
                    except json.JSONDecodeError:
                        return FALLBACK_RESPONSE
                else:
                    return FALLBACK_RESPONSE

            # FIXED: Validate result has required keys
            return {
                "intent_summary": result.get("intent_summary", FALLBACK_RESPONSE["intent_summary"]),
                "risk_explanation": result.get("risk_explanation", FALLBACK_RESPONSE["risk_explanation"]),
                "safe_action": result.get("safe_action", FALLBACK_RESPONSE["safe_action"]),
                "safe_params": result.get("safe_params", {}),
            }

        except (ConnectionError, TimeoutError, IOError) as e:
            return {
                **FALLBACK_RESPONSE,
                "risk_explanation": "AI service connection error. Please review risk flags manually.",
            }

    except Exception as e:
        # FIXED: Catch-all for any unexpected error
        return {
            **FALLBACK_RESPONSE,
            "risk_explanation": f"Unexpected error during analysis. Please review risk flags manually.",
        }
