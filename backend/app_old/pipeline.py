def process_document(file_path):
    text = extract_text(file_path)

    if not text.strip():
        return failed("No readable text found")

    expense = extract_expense(text)
    reasons = validate_expense(expense)

    expense.review_reasons = reasons
    expense.needs_review = True

    save_expense(expense)

    return expense