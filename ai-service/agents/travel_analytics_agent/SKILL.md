# Travel Analytics Agent Skill

## Goal
Parse the Excel file `景点景区旅游数据行为分析数据.xlsx` and convert rows into the travel analytics structured schema.

## Input
- Excel sheet with exact headers:
  - tourist_id,user_nickname,age,gender,attraction_name,attraction_content,attraction_type,visit_date,stay_duration,ticket_cost,food_cost,shopping_cost,transport_cost,entertainment_cost,total_cost,group_size,satisfaction

## Output
- Normalized records compatible with backend table `travel_analytics_record`.
- Import diagnostics: missing key fields, duplicates, empty rows.

## Constraints
- Keep all fields as strings.
- `tourist_id` is required.
- Do not drop valid rows.
