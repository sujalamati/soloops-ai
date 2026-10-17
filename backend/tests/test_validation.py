from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from app.schemas import ExpenseExtracted
from app.services.validation_service import validate_expense

def test_missing_required_fields_are_flagged():
    expense = ExpenseExtracted()
    reasons = validate_expense(expense, "", [])
    assert any("Merchant" in r for r in reasons)
    assert any("date" in r.lower() for r in reasons)
    assert any("Total" in r for r in reasons)
    assert any("Currency" in r for r in reasons)

def test_arithmetic_mismatch_is_flagged():
    expense = ExpenseExtracted(merchant="Shop", expense_date=date(2026, 10, 1), currency="INR", subtotal=Decimal("100"), tax=Decimal("18"), total=Decimal("120"), category="other")
    reasons = validate_expense(expense, "", [])
    assert any("Subtotal plus tax" in r for r in reasons)

def test_possible_duplicate_is_flagged():
    expense = ExpenseExtracted(merchant="Shop", expense_date=date(2026, 10, 1), currency="INR", total=Decimal("118"), category="other")
    existing = [SimpleNamespace(id=7, merchant=" shop ", expense_date="2026-10-01", total="118", currency="INR")]
    reasons = validate_expense(expense, "", existing)
    assert any("duplicate of expense #7" in r for r in reasons)
