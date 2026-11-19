
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

import re
import unicodedata


# --------------------------------------------------
# 1. TEXT NORMALIZATION
# --------------------------------------------------

def normalize_text(value):
    """Clean and standardize text fields."""

    if value is None:
        return None

    value = unicodedata.normalize("NFKC", str(value))
    value = re.sub(r"\s+", " ", value)
    value = value.strip()

    return value or None


# --------------------------------------------------
# 2. DATE NORMALIZATION
# --------------------------------------------------

def normalize_date(value):
    """Convert supported date formats into date objects."""

    if value is None or value == "":
        return None

    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, date):
        return value

    if isinstance(value, str):
        try:
            return date.fromisoformat(value.strip())
        except ValueError:
            raise ValueError(
                f"Invalid date format: {value}. Use YYYY-MM-DD."
            )

    raise ValueError("Unsupported date value.")


# --------------------------------------------------
# 3. AMOUNT NORMALIZATION
# --------------------------------------------------

def normalize_amount(value):
    """Convert financial amounts into Decimal."""

    try:
        amount = Decimal(str(value).replace(",", "").strip())
    except (InvalidOperation, ValueError, AttributeError):
        raise ValueError("Invalid subscription amount.")

    if not amount.is_finite() or amount < 0:
        raise ValueError("Amount must be a non-negative number.")

    return amount.quantize(Decimal("0.01"))


# --------------------------------------------------
# 4. MONTHLY COST CONVERSION
# --------------------------------------------------

def calculate_monthly_cost(
    amount,
    billing_interval,
    custom_days=None
):
    """
    Convert subscription amounts into monthly equivalents.

    One-time purchases are not counted as recurring spend.
    """

    amount = normalize_amount(amount)

    interval = normalize_text(billing_interval)

    conversions = {
        "weekly": Decimal("52") / Decimal("12"),
        "monthly": Decimal("1"),
        "quarterly": Decimal("1") / Decimal("3"),
        "half_yearly": Decimal("1") / Decimal("6"),
        "yearly": Decimal("1") / Decimal("12"),
        "one_time": Decimal("0"),
    }

    if interval in conversions:
        return (
            amount * conversions[interval]
        ).quantize(Decimal("0.01"))

    if interval == "custom":
        if not custom_days or custom_days <= 0:
            raise ValueError(
                "Custom billing requires a positive custom_days value."
            )

        monthly_factor = (
            Decimal("365.2425")
            / Decimal("12")
            / Decimal(str(custom_days))
        )

        return (
            amount * monthly_factor
        ).quantize(Decimal("0.01"))

    raise ValueError(
        f"Unsupported billing interval: {interval}"
    )


# --------------------------------------------------
# 5. CATEGORY AND USAGE NORMALIZATION
# --------------------------------------------------

def normalize_usage_score(value):
    if value is None:
        return None

    try:
        score = int(value)
    except (ValueError, TypeError):
        raise ValueError("Usage score must be an integer.")

    if not 0 <= score <= 100:
        raise ValueError("Usage score must be between 0 and 100.")

    return score


def resolve_usage_score(category, usage_score, category_defaults=None):
    """
    Use reported usage when available.
    Otherwise use a configurable category default.
    """

    reported_score = normalize_usage_score(usage_score)

    if reported_score is not None:
        return reported_score, "user_reported"

    defaults = category_defaults or {}

    category_key = (category or "").strip().lower()

    default_score = defaults.get(category_key)

    if default_score is not None:
        return normalize_usage_score(default_score), "category_default"

    return None, "missing"


# --------------------------------------------------
# 6. COMPLETE RECORD PREPROCESSING
# --------------------------------------------------

def preprocess_subscription_record(
    record,
    category_defaults=None,
    custom_days=None
):
    """
    Clean one subscription record.

    Returns normalized data without saving it to MySQL.
    """

    name = normalize_text(
        record.get("custom_name")
        or record.get("provider_name")
    )

    if not name:
        raise ValueError("Subscription name is required.")

    amount = normalize_amount(record.get("amount"))

    interval = normalize_text(
        record.get("billing_interval")
    )

    if not interval:
        raise ValueError("Billing interval is required.")

    currency = normalize_text(
        record.get("currency") or "INR"
    ).upper()

    if not re.fullmatch(r"[A-Z]{3}", currency):
        raise ValueError("Currency must be a three-letter code.")

    category = normalize_text(
        record.get("category") or "Uncategorized"
    )

    usage_score, usage_source = resolve_usage_score(
        category,
        record.get("usage_score"),
        category_defaults
    )

    monthly_cost = calculate_monthly_cost(
        amount,
        interval,
        custom_days
    )

    return {
        "name": name,
        "amount": amount,
        "currency": currency,
        "billing_interval": interval,
        "monthly_cost": monthly_cost,
        "category": category,
        "usage_score": usage_score,
        "usage_source": usage_source,
        "start_date": normalize_date(
            record.get("start_date")
        ),
        "next_billing_date": normalize_date(
            record.get("next_billing_date")
        ),
        "source": normalize_text(
            record.get("source") or "manual"
        ),
    }


# --------------------------------------------------
# 7. DUPLICATE DETECTION
# --------------------------------------------------

def find_duplicate_candidates(records):
    """
    Identify possible duplicates.

    Does not delete records automatically because
    two subscriptions can legitimately have the
    same provider and price.
    """

    seen = {}
    duplicates = []

    for index, record in enumerate(records):

        key = (
            normalize_text(record.get("name") or "").lower(),
            str(record.get("amount")),
            normalize_text(
                record.get("currency") or "INR"
            ).upper(),
            normalize_text(
                record.get("billing_interval") or ""
            ).lower(),
        )

        if key in seen:
            duplicates.append({
                "record_index": index,
                "possible_duplicate_of": seen[key],
                "reason": "Matching provider, amount, currency and billing interval"
            })
        else:
            seen[key] = index

    return duplicates


# --------------------------------------------------
# 8. AI FEATURE PREPARATION
# --------------------------------------------------

def prepare_ai_features(
    processed_record,
    monthly_budget,
    today=None
):
    """
    Prepare numerical features for the AI engine.

    Missing values remain None instead of being
    silently replaced with misleading values.
    """

    today = today or date.today()

    monthly_cost = processed_record["monthly_cost"]

    usage_score = processed_record["usage_score"]

    if monthly_budget is not None:
        monthly_budget = normalize_amount(monthly_budget)

    if monthly_budget is not None and monthly_budget > 0:
        cost_to_budget_ratio = float(
            monthly_cost / monthly_budget
        )
    else:
        cost_to_budget_ratio = None

    next_billing_date = processed_record["next_billing_date"]

    if next_billing_date is not None:
        days_until_renewal = (
            next_billing_date - today
        ).days
    else:
        days_until_renewal = None

    return {
        "monthly_cost": float(monthly_cost),
        "usage_score": usage_score,
        "cost_to_budget_ratio": cost_to_budget_ratio,
        "days_until_renewal": days_until_renewal,
    }
