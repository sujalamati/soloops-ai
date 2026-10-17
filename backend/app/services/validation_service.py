from datetime import date
from decimal import Decimal
from ..schemas import ExpenseExtracted

MATERIAL_DIFFERENCE = Decimal("0.02")

def validate_expense(expense: ExpenseExtracted, raw_text: str, existing_records: list) -> list[str]:
    reasons: list[str] = []
    if not expense.merchant or not expense.merchant.strip():
        reasons.append("Merchant is missing or could not be extracted.")
    if expense.expense_date is None:
        reasons.append("Expense date is missing or could not be extracted.")
    elif expense.expense_date > date.today():
        reasons.append("Expense date is in the future; verify it.")
    if expense.total is None:
        reasons.append("Total amount is missing or could not be extracted.")
    if not expense.currency:
        reasons.append("Currency is unknown; verify it before export.")
    if expense.subtotal is not None and expense.tax is not None and expense.total is not None:
        if abs((expense.subtotal + expense.tax) - expense.total) > MATERIAL_DIFFERENCE:
            reasons.append("Subtotal plus tax does not match total; verify discounts, fees, and rounding.")
    normalized_merchant = (expense.merchant or "").strip().casefold()
    for record in existing_records:
        if (normalized_merchant and normalized_merchant == (record.merchant or "").strip().casefold()
            and str(expense.expense_date or "") == str(record.expense_date or "")
            and expense.total is not None and record.total is not None
            and Decimal(str(expense.total)) == Decimal(str(record.total))
            and (expense.currency or "") == (record.currency or "")):
            reasons.append(f"Possible duplicate of expense #{record.id} (same merchant, date, amount, and currency).")
            break
    return reasons
