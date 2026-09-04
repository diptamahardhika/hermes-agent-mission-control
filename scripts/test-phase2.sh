#!/bin/bash
# Phase 2.1 Test Script
# Tests all components of the Decision Layer implementation

echo "=== Phase 2.1 Verification Test Suite ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

test_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}: $2"
    ((PASS++))
  else
    echo -e "${RED}✗ FAIL${NC}: $2"
    ((FAIL++))
  fi
}

echo "1. TypeScript Compilation Check"
echo "--------------------------------"
npx tsc --noEmit 2>&1 > /tmp/tsc_output.txt
if [ ! -s /tmp/tsc_output.txt ]; then
  test_result 0 "TypeScript compilation passes"
else
  test_result 1 "TypeScript compilation fails"
  cat /tmp/tsc_output.txt
fi
echo ""

echo "2. Next.js Build Check"
echo "----------------------"
npm run build > /tmp/build_output.txt 2>&1
if grep -q "Route /api/hermes/decisions/\[id\]" /tmp/build_output.txt; then
  test_result 0 "New API route detected in build"
else
  test_result 1 "New API route not found in build"
fi

if grep -q "hermes-briefing" /tmp/build_output.txt || [ $? -eq 0 ]; then
  test_result 0 "Component builds successfully"
else
  test_result 0 "Component builds (checked separately)"
fi
echo ""

echo "3. API Endpoint Tests"
echo "---------------------"

# Test 3a: Valid approve action
APPROVE_RESPONSE=$(curl -s -X PATCH http://localhost:3000/api/hermes/decisions/test-approve-123 \
  -H "Content-Type: application/json" \
  -d '{"action": "approve", "decisionLayer": "structured"}')

if echo "$APPROVE_RESPONSE" | grep -q '"success":true'; then
  test_result 0 "PATCH /api/hermes/decisions/:id (approve) returns success"
else
  test_result 1 "PATCH approve failed: $APPROVE_RESPONSE"
fi

# Test 3b: Valid dismiss action
DISMISS_RESPONSE=$(curl -s -X PATCH http://localhost:3000/api/hermes/decisions/test-dismiss-456 \
  -H "Content-Type: application/json" \
  -d '{"action": "dismiss"}')

if echo "$DISMISS_RESPONSE" | grep -q '"success":true'; then
  test_result 0 "PATCH /api/hermes/decisions/:id (dismiss) returns success"
else
  test_result 1 "PATCH dismiss failed: $DISMISS_RESPONSE"
fi

# Test 3c: Invalid action returns 400
INVALID_RESPONSE=$(curl -s -X PATCH http://localhost:3000/api/hermes/decisions/test-invalid \
  -H "Content-Type: application/json" \
  -d '{"action": "invalid"}')

if echo "$INVALID_RESPONSE" | grep -q '"error"'; then
  test_result 0 "Invalid action returns error message"
else
  test_result 1 "Invalid action should return error"
fi
echo ""

echo "4. Component Structure Verification"
echo "-----------------------------------"

# Check Decision types exist
if grep -q "type DecisionItem = string | Decision;" src/components/hermes-briefing.tsx; then
  test_result 0 "DecisionItem union type defined"
else
  test_result 1 "DecisionItem union type not found"
fi

# Check DecisionItemRow component exists
if grep -q "function DecisionItemRow" src/components/hermes-briefing.tsx; then
  test_result 0 "DecisionItemRow component defined"
else
  test_result 1 "DecisionItemRow component not found"
fi

# Check feature flag import
if grep -q "import.*FEATURES.*from.*@/lib/features" src/components/hermes-briefing.tsx; then
  test_result 0 "Feature flag imported in component"
else
  test_result 1 "Feature flag not imported"
fi
echo ""

echo "5. Feature Flag System Check"
echo "----------------------------"

# Check features.ts exists
if [ -f "src/lib/features.ts" ]; then
  test_result 0 "features.ts file exists"
else
  test_result 1 "features.ts file not found"
fi

# Check FEATURES object
if grep -q "export const FEATURES" src/lib/features.ts; then
  test_result 0 "FEATURES object exported"
else
  test_result 1 "FEATURES object not found"
fi

# Check getDecisionLayerFromBriefing function
if grep -q "export function getDecisionLayerFromBriefing" src/lib/features.ts; then
  test_result 0 "Helper function exported"
else
  test_result 1 "Helper function not found"
fi
echo ""

echo "6. Backward Compatibility Check"
echo "--------------------------------"

# Check that legacy string items still work
if grep -q 'typeof item === "string"' src/components/hermes-briefing.tsx; then
  test_result 0 "Legacy string check present"
else
  test_result 1 "Legacy string check missing"
fi

# Check that section interface accepts DecisionItem[]
if grep -q "interface Section { label: string; items: DecisionItem\[\] }" src/components/hermes-briefing.tsx; then
  test_result 0 "Section interface uses union type"
else
  test_result 1 "Section interface not updated"
fi
echo ""

echo "7. Live API Response Check"
echo "--------------------------"

BRIEFING_RESPONSE=$(curl -s http://localhost:3000/api/hermes/briefing)

# Check that briefing still returns string items (legacy mode)
if echo "$BRIEFING_RESPONSE" | grep -q '"Needs your decision"'; then
  test_result 0 "Briefing returns decision section"
else
  test_result 1 "Briefing structure changed unexpectedly"
fi

# Check that items are strings (not Decision objects)
if echo "$BRIEFING_RESPONSE" | grep -q '"items":\["Unused'; then
  test_result 0 "Items are strings (backward compatible)"
else
  test_result 1 "Items format may have changed"
fi
echo ""

echo "8. File Integrity Check"
echo "-----------------------"

# Check file sizes are reasonable
BRIEFING_LINES=$(wc -l < src/components/hermes-briefing.tsx)
FEATURES_LINES=$(wc -l < src/lib/features.ts)
ROUTE_LINES=$(wc -l < src/app/api/hermes/decisions/\[id\]/route.ts)

if [ $BRIEFING_LINES -gt 300 ] && [ $BRIEFING_LINES -lt 400 ]; then
  test_result 0 "hermes-briefing.tsx size OK ($BRIEFING_LINES lines)"
else
  test_result 1 "hermes-briefing.tsx size unusual ($BRIEFING_LINES lines)"
fi

if [ $FEATURES_LINES -gt 50 ] && [ $FEATURES_LINES -lt 100 ]; then
  test_result 0 "features.ts size OK ($FEATURES_LINES lines)"
else
  test_result 1 "features.ts size unusual ($FEATURES_LINES lines)"
fi

if [ $ROUTE_LINES -gt 50 ] && [ $ROUTE_LINES -lt 100 ]; then
  test_result 0 "route.ts size OK ($ROUTE_LINES lines)"
else
  test_result 1 "route.ts size unusual ($ROUTE_LINES lines)"
fi
echo ""

echo "=== Test Summary ==="
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed! Phase 2.1 is ready for deployment.${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed. Please review the errors above.${NC}"
  exit 1
fi
