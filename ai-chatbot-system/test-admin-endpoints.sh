#!/bin/bash

echo "Testing All Admin CMS API Endpoints"
echo "===================================="

BASE_URL="http://localhost:3000/api/v1"

# Get auth token
echo -e "\n🔐 Getting auth token..."
TOKEN=$(curl -s -X POST ${BASE_URL}/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get auth token"
  exit 1
fi

echo "✅ Got token: ${TOKEN:0:20}..."

# Test all endpoints
echo -e "\n📊 Testing Dashboard endpoints..."
echo -n "  - /dashboard/stats: "
curl -s ${BASE_URL}/dashboard/stats -H "Authorization: Bearer $TOKEN" | jq -r 'if .totalConversations != null then "✅ OK" else "❌ Failed" end'

echo -n "  - /dashboard/recent-conversations: "
curl -s ${BASE_URL}/dashboard/recent-conversations -H "Authorization: Bearer $TOKEN" | jq -r 'if . != null then "✅ OK" else "❌ Failed" end'

echo -e "\n📄 Testing Documents endpoints..."
echo -n "  - /documents (GET): "
curl -s ${BASE_URL}/documents -H "Authorization: Bearer $TOKEN" | jq -r 'if . != null then "✅ OK" else "❌ Failed" end'

echo -n "  - /documents/search: "
curl -s "${BASE_URL}/documents/search?q=test" -H "Authorization: Bearer $TOKEN" 2>/dev/null | jq -r 'if . != null then "✅ OK" else "❌ Failed" end' || echo "❌ Not implemented"

echo -e "\n🎓 Testing Training endpoints..."
echo -n "  - /training (GET): "
curl -s ${BASE_URL}/training -H "Authorization: Bearer $TOKEN" 2>/dev/null | jq -r 'if . != null then "✅ OK" else "❌ Failed" end' || echo "❌ Not implemented"

echo -n "  - /training/qa (GET): "
curl -s ${BASE_URL}/training/qa -H "Authorization: Bearer $TOKEN" 2>/dev/null | jq -r 'if . != null then "✅ OK" else "❌ Failed" end' || echo "❌ Not implemented"

echo -e "\n💬 Testing Conversations endpoints..."
echo -n "  - /conversations (GET): "
curl -s ${BASE_URL}/conversations -H "Authorization: Bearer $TOKEN" | jq -r 'if . != null then "✅ OK" else "❌ Failed" end'

echo -e "\n📈 Testing Analytics endpoints..."
echo -n "  - /analytics (GET): "
curl -s ${BASE_URL}/analytics -H "Authorization: Bearer $TOKEN" | jq -r 'if . != null then "✅ OK" else "❌ Failed" end'

echo -e "\n⚙️ Testing Settings endpoints..."
echo -n "  - /settings (GET): "
curl -s ${BASE_URL}/settings -H "Authorization: Bearer $TOKEN" 2>/dev/null | jq -r 'if . != null then "✅ OK" else "❌ Failed" end' || echo "❌ Not implemented"

echo -e "\n🏥 Testing Health endpoint..."
echo -n "  - /health: "
curl -s ${BASE_URL}/health | jq -r 'if .status != null then "✅ OK" else "❌ Failed" end'

echo -e "\n===================================="
echo "Testing complete!"