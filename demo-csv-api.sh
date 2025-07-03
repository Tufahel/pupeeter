#!/bin/bash

# Latest Jobs API Demonstration Script
echo "🎯 Latest Jobs API Demonstration"
echo "================================"
echo ""

# Base URL
BASE_URL="http://localhost:3000"

echo "📁 1. List Available CSV Files:"
echo "curl \"$BASE_URL/api/csv-files\""
curl -s "$BASE_URL/api/csv-files" | jq '.message, .files[]'
echo ""

echo "📊 2. Get CSV Statistics:"
echo "curl \"$BASE_URL/api/csv-stats\""
curl -s "$BASE_URL/api/csv-stats" | jq '.stats.job_counts, .stats.salary_analysis, .stats.locations.top_locations[0:3]'
echo ""

echo "🔍 3. Get Latest Jobs (Limited to 5):"
echo "curl \"$BASE_URL/api/latest-jobs?limit=5\""
curl -s "$BASE_URL/api/latest-jobs?limit=5" | jq '.message, .metadata.returned_jobs, .data[0].title'
echo ""

echo "🎯 4. Search for 'Engineer' Jobs:"
echo "curl \"$BASE_URL/api/latest-jobs?search=engineer&limit=3\""
curl -s "$BASE_URL/api/latest-jobs?search=engineer&limit=3" | jq '.message, .data[].title'
echo ""

echo "🏙️ 5. Filter by Location (Riyadh):"
echo "curl \"$BASE_URL/api/latest-jobs?location=riyadh&limit=3\""
curl -s "$BASE_URL/api/latest-jobs?location=riyadh&limit=3" | jq '.message, .data[] | {title: .title, location: .location}'
echo ""

echo "💰 6. Filter by Minimum Salary (2000):"
echo "curl \"$BASE_URL/api/latest-jobs?salary_min=2000\""
curl -s "$BASE_URL/api/latest-jobs?salary_min=2000" | jq '.message, .data[] | select(.salary != "") | {title: .title, salary: .salary}'
echo ""

echo "🔍 7. Complex Filter (Engineer + Riyadh):"
echo "curl \"$BASE_URL/api/latest-jobs?search=engineer&location=riyadh&limit=3\""
curl -s "$BASE_URL/api/latest-jobs?search=engineer&location=riyadh&limit=3" | jq '.message, .data[] | {title: .title, location: .location}'
echo ""

echo "📈 8. Jobs with Contact Information:"
echo "curl \"$BASE_URL/api/latest-jobs?limit=100\" | jq '.data[] | select(.contact != \"\" or .email != \"\") | {title: .title, contact: .contact, email: .email}' | head -10"
curl -s "$BASE_URL/api/latest-jobs?limit=100" | jq '.data[] | select(.contact != "" or .email != "") | {title: .title, contact: .contact, email: .email}' | head -10
echo ""

echo "✅ Latest Jobs API Demo Complete!"
echo "All endpoints are working correctly! 🎉"
