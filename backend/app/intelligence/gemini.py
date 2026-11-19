import json
import logging
import os
import requests

logger = logging.getLogger("subloo.intelligence.gemini")


def generate_llm_insight(subscription_name, monthly_cost, currency, usage_score, billing_interval):
    """
    Optional Gemini LLM enhancement for generating tailored subscription savings insights.
    Falls back gracefully to None if GEMINI_API_KEY is not set or network is unavailable.
    """
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return None

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key.strip()}"
    prompt = (
        f"You are a SaaS subscription cost-optimization expert. "
        f"Analyze this subscription: Name: {subscription_name}, Cost: {currency} {monthly_cost}/month ({billing_interval}), "
        f"Usage Score: {usage_score}/100. "
        f"Provide a 2-sentence actionable assessment explaining why the user should keep, downgrade, or cancel, "
        f"and the exact estimated monthly savings."
    )

    try:
        resp = requests.post(
            url,
            json={
                "contents": [
                    {
                        "parts": [{"text": prompt}]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 150,
                }
            },
            headers={"Content-Type": "application/json"},
            timeout=5,
        )

        if resp.status_code == 200:
            data = resp.json()
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts and "text" in parts[0]:
                    return parts[0]["text"].strip()
    except Exception as e:
        logger.warning(f"Gemini API request skipped: {e}")

    return None
