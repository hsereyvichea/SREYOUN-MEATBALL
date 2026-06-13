export function sanitizeCalc(input) {
  return String(input)
    .replace(/\u00d7/g, "*")
    .replace(/\u00f7/g, "/")
    .replace(/[^0-9+\-*/().\s]/g, "");
}

export function evaluateCalcExpression(input) {
  const expression = sanitizeCalc(input).replace(/\s+/g, "");
  let index = 0;

  function peek() {
    return expression[index];
  }

  function consume(expected) {
    if (peek() !== expected) return false;
    index += 1;
    return true;
  }

  function parseNumber() {
    const start = index;
    let hasDigit = false;
    let hasDot = false;

    while (index < expression.length) {
      const char = expression[index];

      if (char >= "0" && char <= "9") {
        hasDigit = true;
        index += 1;
      } else if (char === "." && !hasDot) {
        hasDot = true;
        index += 1;
      } else {
        break;
      }
    }

    if (!hasDigit) throw new Error("Expected number");

    const value = Number(expression.slice(start, index));
    if (!Number.isFinite(value)) throw new Error("Invalid number");

    return value;
  }

  function parseFactor() {
    if (consume("+")) return parseFactor();
    if (consume("-")) return -parseFactor();

    if (consume("(")) {
      const value = parseExpression();
      if (!consume(")")) throw new Error("Expected closing parenthesis");
      return value;
    }

    return parseNumber();
  }

  function parseTerm() {
    let value = parseFactor();

    while (index < expression.length) {
      if (consume("*")) {
        value *= parseFactor();
      } else if (consume("/")) {
        value /= parseFactor();
      } else {
        break;
      }
    }

    return value;
  }

  function parseExpression() {
    let value = parseTerm();

    while (index < expression.length) {
      if (consume("+")) {
        value += parseTerm();
      } else if (consume("-")) {
        value -= parseTerm();
      } else {
        break;
      }
    }

    return value;
  }

  if (!expression) throw new Error("Empty expression");

  const result = parseExpression();

  if (index !== expression.length || !Number.isFinite(result)) {
    throw new Error("Invalid expression");
  }

  return result;
}
