from datetime import date
from decimal import Decimal
from pydantic import BaseModel, Field


class Expense(BaseModel):
    merchant: str | None = None
    expense_date: date | None = None
    currency: str | None = None

    subtotal: Decimal | None = None
    tax: Decimal | None = None
    total: Decimal | None = None

    category: str | None = None
    
    needs_review: bool = True
    review_reasons: list[str] = Field(default_factory=list)